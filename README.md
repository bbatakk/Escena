# Escena

Web responsive per reunir la informació de cada concert i veure què queda pendent sense mantenir un checklist general. Interfície en català.

## Arrencar

Requisits: Node.js 20+ i npm.

```bash
npm install
npm run dev
```

Sense variables d'entorn funciona en **mode demostració**: tres concerts d'exemple i canvis desats només al `localStorage` d'aquell navegador. No són dades compartides entre mòbils o ordinadors.

## Dades compartides (Supabase)

1. Crea un projecte a [Supabase](https://supabase.com/). Abans de crear cap usuari, executa `supabase/migrations/202609240001_initial.sql` a l'SQL Editor. El trigger crea una banda per cada compte nou i les polítiques RLS separen els concerts de cada banda.
2. A **Project Settings → API**, copia la URL del projecte i la clau **anon/publishable**. Crea `.env.local` a partir de `.env.example` i assigna `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`. Mai facis servir la clau `service_role` al navegador.
3. A **Authentication → URL Configuration** de Supabase posa la URL principal HTTPS de Vercel (per exemple, `https://escena.vercel.app`) com a **Site URL** i afegeix aquesta mateixa URL a **Redirect URLs**. El registre envia la confirmació a l'origen on s'ha obert l'app; si proves una URL de previsualització diferent, afegeix-la també a les Redirect URLs. Supabase ha de permetre el destí o pot tornar al Site URL configurat.
4. Reinicia el servidor. Des de la pantalla d'accés crea el compte compartit de la banda. Si Supabase demana verificar el correu, confirma'l abans d'entrar. Fes servir aquest compte als dispositius de prova. Si ja havies confirmat un correu amb un enllaç que acabava a `localhost`, prova d'entrar directament des de la URL de Vercel: normalment el compte ja està confirmat.

5. Per adjuntar fitxers, executa també `supabase/migrations/202609240002_concert_documents.sql` a l'SQL Editor. Crea un bucket **privat** amb polítiques per banda. Desa el concert i el document, obre la fitxa i utilitza **Adjuntar fitxer**. Màxim 20 MB per fitxer. L'app crea enllaços temporals per obrir-los; adjuntar no canvia l'estat d'«enviat»/«rebut». Els enllaços HTTPS externs continuen funcionant.
6. Per utilitzar **Documents de la banda**, executa `supabase/migrations/202609240003_band_documents.sql` després de les dues anteriors. A la biblioteca pots desar riders, bios o enllaços i adjuntar fitxers privats. A la fitxa d'un concert, tria'n un per afegir-hi una còpia de la referència amb un estat propi. Arxivar-lo a la biblioteca no afecta els concerts que ja l'utilitzen; si substitueixes el fitxer compartit, els concerts anteriors mantenen l'original. Si ja havies executat la migració 003 abans d'aquesta correcció, executa també `supabase/migrations/202609240004_repair_shared_storage.sql`.

Tresoreria registra moviments manuals; les vendes de marxandatge de cada fitxa s’hi sumen automàticament als ingressos i al balanç.

7. Per activar **Tresoreria**, executa `supabase/migrations/202609240005_money_movements.sql`. Els moviments poden ser ingressos o despeses, generals o vinculats a un concert. No substitueixen encara els imports resum de la fitxa.
8. Per activar **Marxandatge**, executa `supabase/migrations/202609240006_merch.sql`. Crea productes amb preu i estoc, i registra les vendes ràpidament des de la fitxa del concert. El control d’estoc també es valida a la base de dades.

9. La PWA es genera automàticament amb Vite: després del desplegament es pot instal·lar al mòbil. Amb una sessió autenticada, l'app guarda l'última llista de concerts i permet marcar material sense connexió; en tornar la xarxa, prova de sincronitzar els canvis. Tresoreria, documents i marxandatge poden mostrar les últimes dades guardades localment quan no hi ha connexió.
10. La migració `supabase/migrations/202609240007_members_roles.sql` només prepara rols i invitacions. No cal executar-la per la prova amb compte compartit; executa-la quan vulguis començar la transició a comptes individuals.
11. Per activar **Persones**, **Material** i **Setlists**, executa `supabase/migrations/202609240008_band_resources.sql`. Són catàlegs separats i apareixen com a selectors dins la fitxa de cada concert.
12. Per poder eliminar documents de la biblioteca i els seus fitxers de Storage, executa `supabase/migrations/202609240009_band_documents_delete.sql`.
13. Per afegir talles i estoc independent a cada talla de marxandatge, executa `supabase/migrations/202609240010_merch_sizes.sql`.
14. Després de la migració 010, executa `supabase/migrations/202609240011_merch_stock_guard.sql` per conservar correctament les vendes històriques sense talla i impedir reduccions d’estoc per sota de les unitats venudes.
15. Per canviar el nom de l’espai compartit, executa `supabase/migrations/202609240012_workspace_name.sql`.
16. Per pujar un logotip o una imatge de la banda, executa `supabase/migrations/202609240013_band_logo.sql`. La imatge es desa en un bucket privat i només la poden consultar els membres de la banda.
17. Per activar l’assistent amb el nivell gratuït de Gemini, crea una clau a Google AI Studio i desa-la com a secret amb `supabase secrets set GEMINI_API_KEY=...`. Executa també `supabase/migrations/202609240014_ai_daily_limit.sql` i desplega `supabase functions deploy concert-assistant`. El límit de l’app és de 10 peticions per compte i dia; Google aplica les seves pròpies quotes gratuïtes. Opcionalment configura `GEMINI_MODEL`; per defecte és `gemini-2.5-flash`. No posis mai la clau al codi web ni a `.env.local`.
15. Per poder personalitzar el nom de l’espai de la banda, executa `supabase/migrations/202609240012_workspace_name.sql`.

## Provar des del mòbil, fora de localhost

1. Puja aquest projecte a un repositori Git (sense `.env.local`).
2. Importa'l a [Vercel](https://vercel.com/) com a projecte Vite. Build: `npm run build`; directori de sortida: `dist`.
3. A **Environment Variables** de Vercel posa les dues variables `VITE_SUPABASE_*` anteriors i torna a desplegar. Són identificadors públics: la seguretat de les dades depèn de l'autenticació i les polítiques RLS de la migració.
4. Obre la URL HTTPS del desplegament des de qualsevol mòbil i entra amb el compte compartit. Comprova que coincideixi amb el **Site URL** i les **Redirect URLs** de Supabase (pas 3).

Sense comptes/configuració a Supabase i Vercel, el projecte no es pot publicar amb dades compartides només amb el codi font. Durant desenvolupament, `npm run dev` exposa el servidor a la xarxa local (`--host`) i permet provar-lo des d'un mòbil a la mateixa Wi-Fi amb la IP de l'ordinador.

## Verificació

```bash
npm run test
npm run build
```

## Context breu

- `docs/product.md`: objectiu, abast actual i fases posteriors.
- `docs/domain.md`: model de concert i regles dels pendents.
- `AGENTS.md`: guia curta per a eines de desenvolupament amb IA.
