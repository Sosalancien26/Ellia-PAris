# ELLIA PARIS — Templates e-mail Supabase Auth

Copier-coller chaque template dans **Supabase Dashboard → Authentication → Emails → Templates**
puis cliquer sur chaque ligne (Confirm sign up, Invite, Magic link, etc.) et coller le HTML correspondant.

Tous les templates utilisent la **même charte que les e-mails Node** (logo, ivoire, noir, Georgia serif).

---

## 1) Confirm sign up (Confirmation d'inscription)

**Subject :** `Confirmez votre compte ELLIA PARIS`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Bienvenue chez ELLIA PARIS</h2>
      <p style="margin:0 0 16px">Nous sommes ravis de vous accueillir dans Le Cercle ELLIA. Une dernière étape pour activer votre compte et accéder à vos commandes, vos favoris et vos pièces personnalisées.</p>
      <p style="margin:0 0 28px">Confirmez votre adresse e-mail en cliquant ci-dessous :</p>
      <div style="text-align:center;margin:32px 0">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;padding:18px 42px;font-weight:500">Confirmer mon compte</a>
      </div>
      <p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d;line-height:1.6">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/><span style="word-break:break-all;color:#56524c">{{ .ConfirmationURL }}</span></p>
      <p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d">Si vous n'avez pas créé de compte ELLIA PARIS, ignorez simplement cet e-mail.</p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 2) Invite user (Invitation)

**Subject :** `Vous êtes invité·e chez ELLIA PARIS`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Une invitation vous attend</h2>
      <p style="margin:0 0 16px">Vous avez été invité·e à rejoindre Le Cercle ELLIA — l'espace privilégié de la Maison ELLIA PARIS.</p>
      <p style="margin:0 0 28px">Cliquez ci-dessous pour créer votre compte et accepter l'invitation :</p>
      <div style="text-align:center;margin:32px 0">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;padding:18px 42px;font-weight:500">Accepter l'invitation</a>
      </div>
      <p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d;line-height:1.6">Si le bouton ne fonctionne pas, copiez ce lien :<br/><span style="word-break:break-all;color:#56524c">{{ .ConfirmationURL }}</span></p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 3) Magic Link (Lien de connexion)

**Subject :** `Votre lien de connexion ELLIA PARIS`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Votre lien de connexion</h2>
      <p style="margin:0 0 16px">Connectez-vous à votre compte ELLIA PARIS en un clic. Ce lien est valable une seule fois et expire dans 1 heure.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;padding:18px 42px;font-weight:500">Me connecter</a>
      </div>
      <div style="margin-top:32px;padding:18px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-family:Arial,sans-serif;font-size:13.5px;color:#56524c">
        <b style="font-family:Georgia,serif;color:#0d0d0d;font-size:14px">Code de vérification (alternative) :</b><br/>
        <span style="font-family:'Courier New',monospace;font-size:22px;letter-spacing:.3em;color:#0d0d0d;font-weight:bold;display:inline-block;margin-top:8px">{{ .Token }}</span>
      </div>
      <p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d">Si vous n'avez pas demandé ce lien, ignorez simplement cet e-mail. Votre compte reste sécurisé.</p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 4) Change email address (Changement d'adresse)

**Subject :** `Confirmez votre nouvelle adresse e-mail`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Confirmez votre nouvelle adresse</h2>
      <p style="margin:0 0 16px">Vous avez demandé à modifier votre adresse e-mail. Cliquez ci-dessous pour confirmer le changement :</p>
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:13.5px;color:#8a857d">Ancienne adresse : <b style="color:#0d0d0d">{{ .Email }}</b></p>
      <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:13.5px;color:#8a857d">Nouvelle adresse : <b style="color:#0d0d0d">{{ .NewEmail }}</b></p>
      <div style="text-align:center;margin:32px 0">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;padding:18px 42px;font-weight:500">Confirmer le changement</a>
      </div>
      <p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d">Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement à <a href="mailto:contact@ellia-paris.fr" style="color:#0d0d0d">contact@ellia-paris.fr</a>.</p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 5) Reset password (Réinitialisation mot de passe)

**Subject :** `Réinitialisation de votre mot de passe ELLIA PARIS`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Réinitialiser votre mot de passe</h2>
      <p style="margin:0 0 16px">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
      <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:13.5px;color:#8a857d">Ce lien est valable une heure et ne peut être utilisé qu'une seule fois.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;padding:18px 42px;font-weight:500">Choisir un nouveau mot de passe</a>
      </div>
      <p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d;line-height:1.6">Si le bouton ne fonctionne pas :<br/><span style="word-break:break-all;color:#56524c">{{ .ConfirmationURL }}</span></p>
      <p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d">Si vous n'avez pas demandé cette réinitialisation, ignorez ce message. Votre mot de passe actuel reste valide.</p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 6) Reauthentication (Réauthentification)

**Subject :** `Vérification de sécurité ELLIA PARIS`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Vérifions qu'il s'agit bien de vous</h2>
      <p style="margin:0 0 16px">Une opération sensible vient d'être demandée sur votre compte. Pour la valider, entrez le code de vérification ci-dessous sur le site :</p>
      <div style="text-align:center;margin:36px 0;padding:30px;background:#f8f6f1;border:1px solid #efece6">
        <div style="font-family:Arial,sans-serif;font-size:10.5px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d;margin-bottom:14px">Code de vérification</div>
        <div style="font-family:'Courier New',monospace;font-size:38px;letter-spacing:.32em;color:#0d0d0d;font-weight:bold">{{ .Token }}</div>
      </div>
      <p style="margin:0 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d">Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, sécurisez immédiatement votre compte.</p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

---

## 7) Password changed (Notification mot de passe modifié — Security)

**Subject :** `Votre mot de passe ELLIA PARIS a été modifié`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Votre mot de passe a été modifié</h2>
      <p style="margin:0 0 16px">Nous vous confirmons que le mot de passe de votre compte ELLIA PARIS vient d'être modifié.</p>
      <div style="margin:24px 0;padding:18px 22px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-family:Arial,sans-serif;font-size:13.5px;color:#56524c;line-height:1.6">
        <b style="font-family:Georgia,serif;color:#0d0d0d;font-size:14px">Détails de l'action</b><br/>
        Compte : <b style="color:#0d0d0d">{{ .Email }}</b><br/>
        Date : à l'instant
      </div>
      <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15.5px"><b>Vous êtes bien à l'origine de ce changement ?</b></p>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:#56524c">Aucune action n'est nécessaire. Vous pouvez vous connecter avec votre nouveau mot de passe.</p>
      <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15.5px"><b>Ce n'est pas vous ?</b></p>
      <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:14px;color:#56524c">Quelqu'un d'autre a peut-être accédé à votre compte. Sécurisez-le immédiatement.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://ellia-paris.fr/connexion.html" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;padding:16px 36px;font-weight:500">Sécuriser mon compte</a>
      </div>
      <p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d;line-height:1.6">Pour toute question, écrivez-nous à <a href="mailto:contact@ellia-paris.fr" style="color:#0d0d0d">contact@ellia-paris.fr</a>.</p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 8) Email address changed (Notification email modifié — Security)

**Subject :** `Votre adresse e-mail ELLIA PARIS a été modifiée`

```html
<div style="margin:0;padding:40px 12px;background:#f3f1ec">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;box-shadow:0 30px 60px -25px rgba(0,0,0,.12)">
    <div style="text-align:center;padding:36px 0 14px">
      <img src="https://ellia-paris.fr/assets/logo_black_trim.png" alt="ELLIA PARIS" style="height:46px;width:auto" />
      <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#8a857d">Maison de maroquinerie · Paris</div>
    </div>
    <div style="height:1px;background:#efece6;margin:0 40px"></div>
    <div style="padding:36px 44px 40px;font-family:Georgia,'Times New Roman',serif;color:#0d0d0d;font-size:16px;line-height:1.65">
      <h2 style="font-family:Georgia,serif;font-size:24px;margin:0 0 18px;font-weight:500;color:#0d0d0d">Votre adresse e-mail a été modifiée</h2>
      <p style="margin:0 0 16px">Nous vous confirmons que l'adresse e-mail de votre compte ELLIA PARIS vient d'être changée.</p>
      <div style="margin:24px 0;padding:18px 22px;background:#f8f6f1;border-left:3px solid #0d0d0d;font-family:Arial,sans-serif;font-size:13.5px;color:#56524c;line-height:1.7">
        <b style="font-family:Georgia,serif;color:#0d0d0d;font-size:14px">Détails de l'action</b><br/>
        Ancienne adresse : <b style="color:#0d0d0d">{{ .Email }}</b><br/>
        Nouvelle adresse : <b style="color:#0d0d0d">{{ .NewEmail }}</b><br/>
        Date : à l'instant
      </div>
      <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15.5px"><b>Vous êtes bien à l'origine de ce changement ?</b></p>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:#56524c">Aucune action n'est nécessaire. Vous pourrez désormais vous connecter avec votre nouvelle adresse e-mail.</p>
      <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:15.5px"><b>Ce n'est pas vous ?</b></p>
      <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:14px;color:#56524c">Quelqu'un a peut-être accédé à votre compte. Contactez-nous immédiatement pour sécuriser votre compte.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="mailto:contact@ellia-paris.fr" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;padding:16px 36px;font-weight:500">Nous contacter</a>
      </div>
      <p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12.5px;color:#8a857d;line-height:1.6">Cet e-mail a été envoyé à votre ancienne adresse pour vous prévenir du changement.</p>
    </div>
    <div style="background:#0d0d0d;padding:28px 44px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.18em;color:#bdb8af">
      <div style="margin-bottom:10px;color:#ffffff;letter-spacing:.4em">ELLIA &nbsp; PARIS</div>
      <div style="margin-bottom:14px"><a href="https://ellia-paris.fr" style="color:#bdb8af;text-decoration:none">ellia-paris.fr</a> · <a href="https://ellia-paris.fr/contact.html" style="color:#bdb8af;text-decoration:none">Contact</a></div>
      <div style="font-size:10px;letter-spacing:.1em;color:#6e6960;text-transform:none">© 2026 ELLIA PARIS — Tous droits réservés.</div>
    </div>
  </div>
</div>
```

---

## 📋 Procédure d'installation

Pour chaque template :

1. Aller dans **Supabase Dashboard** → ton projet ELLIA → **Authentication** → **Emails**
2. Cliquer sur **Templates** (sélectionné par défaut)
3. Cliquer sur la ligne correspondante (ex : "Confirm sign up")
4. Dans le panel qui s'ouvre :
   - Ligne **Subject** : copier le sujet
   - Bouton **"Source"** ou onglet HTML : effacer le contenu actuel et coller le bloc HTML
5. Cliquer **Save changes** (vert, en bas)
6. Répéter pour les 5 autres templates

## Tests rapides après installation

- **Reset password** : aller sur `/connexion.html` → "Mot de passe oublié" → recevoir l'email design luxe
- **Sign up** : créer un nouveau compte → recevoir l'email de confirmation design luxe
- **Magic link** : si tu actives cette option un jour, le template sera prêt

## Variables Supabase utilisées

- `{{ .ConfirmationURL }}` : URL pour valider l'action (Supabase la génère automatiquement)
- `{{ .Token }}` : code à 6 chiffres pour OTP (au lieu de cliquer un lien)
- `{{ .Email }}` : adresse email actuelle de l'utilisateur
- `{{ .NewEmail }}` : nouvelle adresse (pour changement email uniquement)
