# ManyChat → Lead CRM (Next.js)

Instagram par ManyChat automation se aane wali leads automatically is CRM me save hoti hain.

```
Instagram user → ManyChat Flow → External Request (POST) → /api/webhooks/manychat → Database → CRM UI
                                                                 ↳ (token ho to) ManyChat API /fb/subscriber/getInfo se poori profile
```

## Features
- Webhook se auto lead capture (duplicate nahi banti, `subscriber_id` se update hoti hai)
- ManyChat API se profile, IG username, photo, tags, custom fields ka sync
- Pipeline status: New → Contacted → Interested → Follow-up → Converted / Lost
- Notes, activity timeline, deal value, follow-up date
- Dashboard: aaj ki leads, 7 din ka chart, pipeline, due follow-ups
- Search + filter, Excel export, password login
- Optional: status badalne par ManyChat me `crm_<status>` tag lagana

## Local setup
```bash
npm install
cp .env.example .env      # values bharo
npx prisma db push        # database banao
npm run dev               # http://localhost:3000
```

## .env
| Variable | Kya hai |
|---|---|
| `DATABASE_URL` | Neon pooled Postgres URL |
| `DATABASE_URL_UNPOOLED` | Neon direct Postgres URL (`prisma db push` ke liye) |
| `MANYCHAT_API_TOKEN` | ManyChat → Settings → API → Generate your API Key |
| `WEBHOOK_SECRET` | Lamba random string; ManyChat request header `x-webhook-secret` me same daalna |
| `CRM_PASSWORD` | CRM login password |
| `AUTH_SECRET` | Lamba random string (session sign karne ke liye) |
| `MANYCHAT_SYNC_STATUS_TAGS` | `true` = status change par ManyChat tag |
| `APP_URL` | Deploy hone ke baad apna domain (Setup page par webhook URL ke liye) |
| `CRON_SECRET` | Lamba random string — Instagram auto-sync cron ke liye |
| `IG_ACCESS_TOKEN` | Optional — Instagram token (Setup page se save karna better) |

## ManyChat me connect karna
CRM me login karke **ManyChat Setup** page kholo — wahan exact URL, header aur JSON body copy karne ke liye hai.

Short me: Flow → **+ Action → Dev Tools → External Request**
- **POST** `https://<your-domain>/api/webhooks/manychat`
- Header: `x-webhook-secret: <WEBHOOK_SECRET>`
- Body:
```json
{
  "subscriber_id": "{{user_id}}",
  "name": "{{full_name}}",
  "ig_username": "{{ig_username}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "message": "{{last_input_text}}",
  "source": "Reel - Free Guide"
}
```
(`{{...}}` values ManyChat ke "Add Variable" button se insert karo. Sirf `subscriber_id` zaroori hai.)

## Local pe ManyChat se test
ManyChat `localhost` tak nahi pahuch sakta. Tunnel use karo:
```bash
npx cloudflared tunnel --url http://localhost:3000
```
Jo `https://….trycloudflare.com` URL mile, wahi ManyChat me daalo.

## Deploy (Vercel)
Database Neon Postgres hai, isliye local aur Vercel dono same DB use karte hain.
1. Vercel → Project → Settings → Environment Variables me `.env` ke saare variables daalo (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `MANYCHAT_API_TOKEN`, `WEBHOOK_SECRET`, `CRM_PASSWORD`, `AUTH_SECRET`, `APP_URL`)
2. Redeploy
3. Schema badle to: `npx prisma db push`

## Instagram DMs se leads (purani / miss hui)
ManyChat API me "saare contacts" ya "chat history" ka endpoint nahi hai, isliye CRM seedha **Instagram Conversations API** se DMs padhta hai.
- Setup page par token save karo (steps wahin likhe hain) → **"Saari purani chats import karo"** ek baar dabao.
- Har chat ka banda lead banta hai; pehle se ManyChat wali lead ho to username se usi me jud jata hai. Baad me ManyChat webhook aaye to bhi duplicate nahi banti.
- Lead page par Instagram chat (last 20 messages — Instagram ki limit) IST time ke saath dikhti hai.
- Auto-sync: `vercel.json` me roz raat 12 baje IST cron hai (`CRON_SECRET` env zaroori). Zyada baar chahiye to cron-job.org se
  `https://<domain>/api/cron/instagram-sync?secret=<CRON_SECRET>` har 15–30 min hit karwao.
- Limits: Requests folder ki 30 din se inactive chats Instagram nahi deta.

## Note
Kisi bhi ManyChat lead ko detail page par **Sync from ManyChat** se refresh kar sakte ho.
