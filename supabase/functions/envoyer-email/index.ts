// =====================================================================
//  Fonction « envoyer-email » — Club C-Tech
//  Envoie les e-mails de la plateforme d'adhésion depuis la boîte Gmail du club.
//
//  Deux usages :
//   - action "accuse"   : appelée juste après le dépôt d'une demande.
//                         1) « Demande bien reçue » au candidat
//                         2) « Nouvelle demande » à tous les membres de la table bureau,
//                            avec la photo, le parcours et la motivation.
//                         Une seule fois par demande, dans les 30 minutes qui suivent.
//   - action "decision" : e-mail de décision écrit par le bureau.
//                         Réservé aux membres connectés présents dans la table bureau.
//
//  Les destinataires viennent TOUJOURS de la base (e-mail du candidat, table bureau) :
//  impossible de se servir de cette fonction pour écrire à quelqu'un d'autre.
//
//  Secrets à définir (Edge Functions > Secrets) :
//   GMAIL_USER          adresse Gmail du club (ex. ctech.adhesion@gmail.com)
//   GMAIL_APP_PASSWORD  mot de passe d'application Gmail (16 lettres)
//   EXPEDITEUR_NOM      facultatif, ex. "Club C-Tech"
//   SITE_URL            facultatif, ex. https://thanzou360.github.io/adhesion-ctech
//   REPONDRE_A          facultatif, adresse qui reçoit les réponses des candidats
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import { Buffer } from "node:buffer";

const env = (k) => Deno.env.get(k) ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: env("GMAIL_USER"), pass: env("GMAIL_APP_PASSWORD") },
});
const NOM = (env("EXPEDITEUR_NOM") || "Club C-Tech").replace(/"/g, "");
const SITE = env("SITE_URL").replace(/\/+$/, "");
const BUCKET = "adhesions";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const texteHtml = (t) => esc(t).replace(/\r?\n/g, "<br>");

const STATUTS = { acceptee: "Acceptée", entretien: "Entretien", refusee: "Non retenue", en_attente: "En attente" };

// ---------- Gabarit HTML commun ----------
function gabarit({ titre, corps, reference, bouton, pied }) {
  const logo = SITE
    ? `<img src="${esc(SITE)}/logo.png" width="44" height="44" alt="" style="display:block;border-radius:50%;border:0">`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#eef1f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f8;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0e1330">
<tr><td style="background:#070912;padding:20px 24px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    ${logo ? `<td style="padding-right:12px">${logo}</td>` : ""}
    <td style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px">C-TECH<br><span style="font-size:12px;font-weight:normal;color:#a0a8c8;letter-spacing:0">Club de Technologie</span></td>
  </tr></table>
</td></tr>
<tr><td style="height:4px;background:#4a7dff;background-image:linear-gradient(90deg,#35e0f0,#4a7dff,#a34cf4)"></td></tr>
<tr><td style="padding:28px 24px 8px;font-size:20px;font-weight:bold;line-height:1.3">${esc(titre)}</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:15px;line-height:1.6;color:#2a3150">${corps}</td></tr>
${reference ? `<tr><td style="padding:0 24px 24px"><div style="display:inline-block;padding:10px 14px;border-radius:10px;background:#eef1fa;font-family:'Courier New',monospace;font-size:15px;letter-spacing:1px;color:#0e1330">Référence : <b>${esc(reference)}</b></div></td></tr>` : ""}
${bouton ? `<tr><td style="padding:0 24px 28px"><a href="${esc(bouton.href)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#4a7dff;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">${esc(bouton.label)}</a></td></tr>` : ""}
<tr><td style="padding:16px 24px;border-top:1px solid #e4e8f4;font-size:12px;color:#7a83a3">${esc(pied || "Club de Technologie C-Tech · Cet e-mail répond à ta demande d'adhésion au club.")}</td></tr>
</table></td></tr></table></body></html>`;
}

async function envoyer({ to, sujet, texte, html, attachments, replyTo }) {
  await transport.sendMail({
    from: `"${NOM}" <${env("GMAIL_USER")}>`,
    to,
    replyTo: replyTo || env("REPONDRE_A") || undefined,
    subject: sujet,
    text: texte,
    html,
    attachments,
  });
}

// E-mail adressé au candidat (accusé de réception ou décision)
function mailCandidat(to, sujet, message, reference) {
  return envoyer({
    to,
    sujet,
    texte: message + `\n\nRéférence : ${reference}` + (SITE ? `\nSuivre ma demande : ${SITE}/#suivi` : ""),
    html: gabarit({
      titre: sujet,
      corps: texteHtml(message),
      reference,
      bouton: SITE ? { href: `${SITE}/#suivi`, label: "Suivre ma demande" } : null,
    }),
  });
}

// E-mail « nouvelle demande » adressé à tous les membres du bureau
async function mailBureau(d) {
  const { data: membres } = await admin.from("bureau").select("email");
  const destinataires = [...new Set((membres || []).map((m) => m.email.trim().toLowerCase()).filter(Boolean))];
  if (!destinataires.length) return { envoye: 0 };

  // La photo est jointe directement dans l'e-mail (le stockage reste privé)
  const attachments = [];
  try {
    const { data: fichier } = await admin.storage.from(BUCKET).download(d.photo_path);
    if (fichier) {
      attachments.push({
        filename: `${d.reference}.jpg`,
        content: Buffer.from(await fichier.arrayBuffer()),
        contentType: "image/jpeg",
        cid: "photo-candidat",
      });
    }
  } catch (_) { /* l'e-mail part quand même, sans photo */ }

  const nom = `${d.prenom} ${d.nom}`;
  const lien = SITE ? `${SITE}/#bureau` : "";
  const extrait = d.motivation.length > 600 ? d.motivation.slice(0, 600).trimEnd() + "…" : d.motivation;
  const ligne = (label, valeur) =>
    valeur ? `<tr><td style="padding:4px 12px 4px 0;color:#7a83a3;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:4px 0;color:#0e1330">${esc(valeur)}</td></tr>` : "";

  const corps = `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
  ${attachments.length ? `<td width="132" style="vertical-align:top;padding-right:16px"><img src="cid:photo-candidat" width="132" height="132" alt="Photo de ${esc(nom)}" style="display:block;width:132px;height:132px;object-fit:cover;border-radius:12px;border:0"></td>` : ""}
  <td style="vertical-align:top">
    <div style="font-size:18px;font-weight:bold;color:#0e1330;margin-bottom:6px">${esc(nom)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">
      ${ligne("Études", `${d.filiere} · ${d.niveau}`)}
      ${ligne("Établissement", d.etablissement)}
      ${ligne("Niveau tech", d.niveau_tech)}
      ${ligne("Domaines", (d.domaines || []).join(", "))}
      ${ligne("Disponibilité", d.disponibilite)}
    </table>
  </td>
</tr></table>
<div style="margin-top:20px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#08899e;text-transform:uppercase">Motivation</div>
<div style="margin-top:6px">${texteHtml(extrait)}</div>
<div style="margin-top:16px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#08899e;text-transform:uppercase">Ce qu'il/elle apportera</div>
<div style="margin-top:6px">${texteHtml(d.apport)}</div>
<div style="margin-top:20px;padding:12px 14px;border-radius:10px;background:#eef1fa;color:#2a3150">Connecte-toi à l'espace bureau pour voir le dossier complet et donner ton avis.</div>`;

  const texte =
    `Nouvelle demande d'adhésion : ${nom} (${d.reference})\n\n` +
    `Études : ${d.filiere} · ${d.niveau} — ${d.etablissement}\n` +
    `Niveau tech : ${d.niveau_tech}\nDomaines : ${(d.domaines || []).join(", ")}\n\n` +
    `Motivation :\n${extrait}\n\nCe qu'il/elle apportera :\n${d.apport}\n\n` +
    (lien ? `Voir le dossier et voter : ${lien}\n` : "Connecte-toi à l'espace bureau pour voter.\n");

  await envoyer({
    to: destinataires.join(", "),
    sujet: `Nouvelle demande d'adhésion : ${nom}`,
    texte,
    html: gabarit({
      titre: "Nouvelle demande d'adhésion",
      corps,
      reference: d.reference,
      bouton: lien ? { href: lien, label: "Voir le dossier et voter" } : null,
      pied: "Plateforme d'adhésion C-Tech · Tu reçois cet e-mail parce que tu es membre du bureau.",
    }),
    attachments,
    replyTo: d.email,
  });
  return { envoye: destinataires.length };
}

// ---------- Après un dépôt : candidat + bureau ----------
async function accuse(body) {
  const ref = String(body.reference || "").trim().toUpperCase();
  if (!/^CT-[A-Z0-9]{5}$/.test(ref)) return json({ error: "Référence invalide." }, 400);

  const { data: d } = await admin
    .from("demandes")
    .select("id, reference, created_at, accuse_envoye_le, prenom, nom, email, etablissement, filiere, niveau, domaines, niveau_tech, motivation, apport, disponibilite, photo_path")
    .eq("reference", ref)
    .maybeSingle();
  if (!d) return json({ error: "Demande introuvable." }, 404);
  if (d.accuse_envoye_le) return json({ ok: true, deja: true });
  if (Date.now() - new Date(d.created_at).getTime() > 30 * 60 * 1000) {
    return json({ error: "Délai dépassé." }, 409);
  }

  // On « réserve » l'envoi avant d'envoyer, pour ne jamais l'envoyer deux fois
  const { data: pris } = await admin
    .from("demandes")
    .update({ accuse_envoye_le: new Date().toISOString() })
    .eq("id", d.id)
    .is("accuse_envoye_le", null)
    .select("id");
  if (!pris?.length) return json({ ok: true, deja: true });

  const message =
    `Bonjour ${d.prenom},\n\n` +
    `Nous avons bien reçu ta demande d'adhésion au Club C-Tech. Merci pour ton intérêt !\n\n` +
    `Le bureau va lire ton dossier, ta photo et tes motivations. Tu recevras notre réponse à cette adresse e-mail.\n\n` +
    `Garde bien ta référence : avec ton numéro WhatsApp, elle te permet de suivre l'avancement de ta demande.\n\n` +
    `À bientôt,\nLe bureau du Club C-Tech`;

  const [candidat, bureau] = await Promise.allSettled([
    mailCandidat(d.email, "Ta demande d'adhésion au Club C-Tech est bien reçue", message, d.reference),
    mailBureau(d),
  ]);
  if (candidat.status === "rejected") console.error("Accusé candidat :", candidat.reason);
  if (bureau.status === "rejected") console.error("Notification bureau :", bureau.reason);
  if (bureau.status === "fulfilled") {
    await admin.from("demandes").update({ bureau_notifie_le: new Date().toISOString() }).eq("id", d.id);
  }
  return json({
    ok: candidat.status === "fulfilled",
    to: d.email,
    bureau: bureau.status === "fulfilled" ? bureau.value.envoye : 0,
  });
}

// ---------- E-mail de décision (bureau) ----------
async function decision(req, body) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const email = auth?.user?.email;
  if (!email) return json({ error: "Connecte-toi à l'espace bureau pour envoyer un e-mail." }, 401);

  const { data: membres } = await admin.from("bureau").select("email, nom");
  const membre = (membres || []).find((m) => m.email.trim().toLowerCase() === email.toLowerCase());
  if (!membre) return json({ error: "Ce compte n'est pas membre du bureau." }, 403);

  const id = String(body.demande_id || "");
  const sujet = String(body.sujet || "").trim();
  const message = String(body.message || "").trim();
  if (!id) return json({ error: "Demande manquante." }, 400);
  if (sujet.length < 3 || sujet.length > 150) return json({ error: "L'objet doit faire entre 3 et 150 caractères." }, 400);
  if (message.length < 10 || message.length > 5000) return json({ error: "Le message doit faire entre 10 et 5000 caractères." }, 400);

  const { data: d } = await admin
    .from("demandes")
    .select("id, email, reference, statut")
    .eq("id", id)
    .maybeSingle();
  if (!d) return json({ error: "Demande introuvable." }, 404);
  if (!d.email) return json({ error: "Ce candidat n'a pas laissé d'adresse e-mail." }, 400);

  await mailCandidat(d.email, sujet, message, d.reference);
  await admin
    .from("demandes")
    .update({ email_envoye_le: new Date().toISOString(), email_statut: d.statut, email_envoye_par: membre.nom })
    .eq("id", d.id);
  return json({ ok: true, to: d.email, statut: STATUTS[d.statut] || d.statut });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "Requête invalide." }, 400);
  }
  try {
    if (body.action === "accuse") return await accuse(body);
    if (body.action === "decision") return await decision(req, body);
    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "L'e-mail n'a pas pu partir. Vérifie GMAIL_USER et GMAIL_APP_PASSWORD dans les secrets." }, 500);
  }
});
