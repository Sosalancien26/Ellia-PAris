# Templates Email Supabase Auth — ELLIA PARIS

## Où coller ces templates

Dashboard Supabase → **Authentication** → onglet **Email Templates**

Pour chaque template ci-dessous :
1. Sélectionne le template dans la liste (Confirm signup, Reset password, etc.)
2. Copie le **Subject** dans le champ "Subject"
3. Copie le **HTML** dans le champ "Message body"
4. Clique **Save**

Les variables `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .TokenHash }}` sont gérées automatiquement par Supabase, ne les change pas.

---

## 1. Confirm signup (création compte)

**Subject** :
```
Bienvenue dans la Maison ELLIA PARIS
```

**HTML** :
```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h1 style="font-weight:normal;font-size:32px;margin:0 0 18px;letter-spacing:.005em">Bienvenue.</h1>
      <p style="margin:0 0 14px">Merci d'avoir rejoint la Maison <b>ELLIA PARIS</b>.</p>
      <p style="margin:0 0 22px">Pour finaliser la création de votre compte et accéder à votre espace, confirmez votre adresse e-mail en cliquant sur le bouton ci-dessous.</p>
      <div style="text-align:center;margin:32px 0 28px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:16px 38px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase">Confirmer mon e-mail</a>
      </div>
      <p style="margin:0 0 14px;font-size:13px;color:#8a857d;font-family:Arial,sans-serif">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="{{ .ConfirmationURL }}" style="color:#0d0d0d;word-break:break-all">{{ .ConfirmationURL }}</a></p>
      <p style="margin:22px 0 0;font-size:13px;color:#8a857d;font-family:Arial,sans-serif">Si vous n'avez pas créé de compte sur ellia-paris.fr, ignorez ce message.</p>
      <p style="margin:28px 0 0;font-size:14px;color:#56524c">Avec soin,<br><span style="font-style:italic">L'équipe ELLIA PARIS</span></p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a> · <a href="https://ellia-paris.fr/entretien.html" style="color:#bdb8af;text-decoration:none">Entretien</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 2. Reset password (mot de passe oublié)

**Subject** :
```
Réinitialisation de votre mot de passe — ELLIA PARIS
```

**HTML** :
```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h1 style="font-weight:normal;font-size:32px;margin:0 0 18px;letter-spacing:.005em">Réinitialisation</h1>
      <p style="margin:0 0 14px">Vous avez demandé à réinitialiser votre mot de passe sur <b>ellia-paris.fr</b>.</p>
      <p style="margin:0 0 22px">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 1 heure.</p>
      <div style="text-align:center;margin:32px 0 28px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:16px 38px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase">Choisir un nouveau mot de passe</a>
      </div>
      <p style="margin:0 0 14px;font-size:13px;color:#8a857d;font-family:Arial,sans-serif">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="{{ .ConfirmationURL }}" style="color:#0d0d0d;word-break:break-all">{{ .ConfirmationURL }}</a></p>
      <p style="margin:22px 0 0;padding:14px 18px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-size:13px;color:#56524c;font-family:Arial,sans-serif;line-height:1.55">Si vous n'avez pas demandé cette réinitialisation, ignorez ce message. Votre mot de passe actuel reste valide et votre compte sécurisé.</p>
      <p style="margin:28px 0 0;font-size:14px;color:#56524c">Avec soin,<br><span style="font-style:italic">L'équipe ELLIA PARIS</span></p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a> · <a href="https://ellia-paris.fr/entretien.html" style="color:#bdb8af;text-decoration:none">Entretien</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 3. Magic Link (connexion sans mot de passe)

**Subject** :
```
Votre lien de connexion — ELLIA PARIS
```

**HTML** :
```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h1 style="font-weight:normal;font-size:32px;margin:0 0 18px;letter-spacing:.005em">Votre lien d'accès</h1>
      <p style="margin:0 0 14px">Voici votre lien de connexion à votre espace personnel <b>ELLIA PARIS</b>.</p>
      <p style="margin:0 0 22px">Pour des raisons de sécurité, ce lien est valable une seule fois et expire dans 1 heure.</p>
      <div style="text-align:center;margin:32px 0 28px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:16px 38px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase">Accéder à mon compte</a>
      </div>
      <p style="margin:0 0 14px;font-size:13px;color:#8a857d;font-family:Arial,sans-serif">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="{{ .ConfirmationURL }}" style="color:#0d0d0d;word-break:break-all">{{ .ConfirmationURL }}</a></p>
      <p style="margin:22px 0 0;padding:14px 18px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-size:13px;color:#56524c;font-family:Arial,sans-serif;line-height:1.55">Si vous n'avez pas demandé cet accès, ignorez ce message — aucun changement ne sera effectué.</p>
      <p style="margin:28px 0 0;font-size:14px;color:#56524c">Avec soin,<br><span style="font-style:italic">L'équipe ELLIA PARIS</span></p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a> · <a href="https://ellia-paris.fr/entretien.html" style="color:#bdb8af;text-decoration:none">Entretien</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 4. Change Email Address (changement d'adresse)

**Subject** :
```
Confirmation de votre nouvelle adresse — ELLIA PARIS
```

**HTML** :
```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h1 style="font-weight:normal;font-size:32px;margin:0 0 18px;letter-spacing:.005em">Nouvelle adresse</h1>
      <p style="margin:0 0 14px">Vous avez demandé à modifier l'adresse e-mail associée à votre compte <b>ELLIA PARIS</b>.</p>
      <p style="margin:0 0 22px">Pour confirmer ce changement, cliquez sur le bouton ci-dessous.</p>
      <div style="text-align:center;margin:32px 0 28px">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:16px 38px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase">Confirmer le changement</a>
      </div>
      <p style="margin:0 0 14px;font-size:13px;color:#8a857d;font-family:Arial,sans-serif">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="{{ .ConfirmationURL }}" style="color:#0d0d0d;word-break:break-all">{{ .ConfirmationURL }}</a></p>
      <p style="margin:22px 0 0;padding:14px 18px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-size:13px;color:#56524c;font-family:Arial,sans-serif;line-height:1.55">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message ou contactez-nous à <a href="mailto:contact@ellia-paris.fr" style="color:#0d0d0d">contact@ellia-paris.fr</a></p>
      <p style="margin:28px 0 0;font-size:14px;color:#56524c">Avec soin,<br><span style="font-style:italic">L'équipe ELLIA PARIS</span></p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a> · <a href="https://ellia-paris.fr/entretien.html" style="color:#bdb8af;text-decoration:none">Entretien</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## Vérifier que ça marche

Une fois les 4 templates collés :
1. Crée un compte test sur `ellia-paris.fr/inscription.html` avec un e-mail jetable (ex : tempmail.com)
2. Vérifie l'email reçu : il doit avoir le logo Ellia + fond ivoire + footer noir
3. Si le SMTP custom est bien configuré, le **expéditeur** sera "ELLIA PARIS <contact@ellia-paris.fr>" (ou ton Gmail) au lieu de Supabase

## Notes

- Le logo Ellia (`https://ellia-paris.fr/assets/logo_black_trim.png`) sera affiché depuis ton site déployé
- Si tu changes de domaine plus tard, remplace les URLs dans les 4 templates
- Les emails sont **inline CSS** uniquement (obligatoire pour la compatibilité avec Gmail, Outlook, Apple Mail)
- Testé compatible : Gmail, Outlook, Apple Mail, Yahoo
