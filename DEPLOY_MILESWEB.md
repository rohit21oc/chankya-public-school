# MilesWeb par deploy (website + backend ek hi Node.js app me)

Backend (`dist/server.cjs`) hi built website (`dist/`) serve karta hai, isliye **sirf 1 Node.js app** lagta hai.
Website aur API dono ek hi domain par chalenge (`https://<domain>` aur `https://<domain>/api/...`), alag frontend hosting nahi chahiye.
Database MongoDB Atlas hi rahega (MilesWeb par MongoDB nahi chahiye).

## 0. Pehle ye ready rakho
- MilesWeb Node.js hosting plan (koi bhi; 1 Node.js app kaafi hai) + domain hosting se connected.
- Render dashboard se purani env values copy kar lo (neeche "Zaroori: kaun si value copy karni hai" dekho).
- MongoDB Atlas → **Network Access** → MilesWeb server ka IP add karo (cPanel ke right side "Shared IP Address" me dikhta hai).
  Bina iske login "Database unavailable" dega.

## 1. cPanel → Setup Node.js App → Create Application
| Field | Value |
|---|---|
| Node.js version | 22.x (ya 20.x se upar) |
| Application mode | Production |
| Application root | `chanakyapublicschool` |
| Application URL | apna domain (root, koi sub-path nahi) |
| Application startup file | `app.cjs` |

Create dabao, phir app ko **Stop** kar do (code aane tak).
Upar jo command dikhe (`source /home/<user>/nodevenv/chanakyapublicschool/22/bin/activate && cd ...`) use copy kar lo.

## 2. Code lao aur build karo (SSH / cPanel Terminal)
```bash
# app folder ko code se bharo (private repo: GitHub token ya deploy key lagega)
cd ~ && rm -rf chanakyapublicschool.tmp
git clone https://github.com/rohit21oc/chanakyapublicschool.git chanakyapublicschool.tmp
cp -a chanakyapublicschool.tmp/. chanakyapublicschool/ && rm -rf chanakyapublicschool.tmp

# .env ko File Manager se ~/chanakyapublicschool/.env par upload karo, phir:
chmod 600 ~/chanakyapublicschool/.env

# Node environment me jao (Step 1 wali command) aur deploy script chalao
source ~/nodevenv/chanakyapublicschool/22/bin/activate
cd ~/chanakyapublicschool && bash scripts/milesweb-deploy.sh
```
Phir cPanel me app **Start / Restart** karo.

Aage har update ke liye bas: `source ...activate && cd ~/chanakyapublicschool && bash scripts/milesweb-deploy.sh`

**SSH nahi hai to:** apne computer par `npm install && npm run build` karo, phir `dist/`, `data/`, `app.cjs`, `package.json`,
`package-lock.json` ko zip karke File Manager se app folder me upload/extract karo, `.env` upload karo,
cPanel me **Run NPM Install** dabao aur app Restart karo.

## 3. SSL
cPanel → SSL/TLS Status → AutoSSL chalao (free). Domain → "Force HTTPS Redirect" on karo.

## 4. Check karo
- `https://<domain>/api/health` → `"status":"UP"`
- Website khulti hai, admin login hota hai, fee receipt PDF download hota hai.
- cPanel app page par logs: `stderr.log` app folder me milega agar kuch fail ho.

## 5. Baaki services ko naya domain batao
- **PhonePe** Business Dashboard → Developer Settings → Webhook → URL: `https://<domain>/api/payments/phonepe/webhook` (Authentication SHA: username/password `.env` mein `PHONEPE_*_WEBHOOK_USERNAME/PASSWORD`). Details: `docs/ONLINE_PAYMENTS.md`.
- **Mobile app:** naya build `EXPO_PUBLIC_API_URL=https://<domain>` ke saath banao, jaise
  `cd mobile && EXPO_PUBLIC_API_URL=https://<domain> eas build -p android --profile production`.
  Purane installed app Render URL use karte hain, isliye **Render ko tab tak band mat karo** jab tak sabke phone par naya app update na ho jaye.

## Zaroori: kaun si value copy karni hai (nayi mat banao)
| Variable | Kyu |
|---|---|
| `MONGODB_URI` | wahi database |
| `JWT_SECRET` | badla to sab users logout ho jayenge (chalega), lekin… |
| `ID_CARD_QR_SECRET` | badla to **sab printed ID cards ke QR invalid**. Render par set nahi hai to `JWT_SECRET` bhi wahi rakho. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | badla to browser notifications dobara allow karne padenge |
| `R2_*` | wahi file storage (photos, documents) |
| `PHONEPE_*`, `BREVO_*`, `SMS_*` | same accounts |

## Dhyan rakhne wali baatein
- Shared hosting idle hone par app ko sula deta hai; pehli request 2-5 sec slow ho sakti hai. Startup par fee/salary jobs dobara chal jaate hain (ye idempotent hain).
- Live updates (SSE) proxy ke peeche buffer ho jayein to app khud polling par chala jata hai, kuch todna nahi padta.
