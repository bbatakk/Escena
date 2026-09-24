# Context per desenvolupar Escena

Llegeix només el document que necessitis: `docs/product.md` per abast, `docs/domain.md` per dades i regles, `README.md` per executar i desplegar.

- La fitxa del concert és el centre del producte. No convertir buits opcionals en tasques obligatòries; `getPending` a `src/model.ts` deriva els avisos de dades explícites.
- Idioma de la interfície: català. Mantén noms curts i precisos; disseny responsive també per al dia del concert.
- El checklist de material és una comprovació física; no crear un checklist genèric per a tot el procés.
- El mode local és una demo aïllada per navegador. Les dades compartides exigeixen Supabase, autenticació i RLS; mai usar claus privades al client.
- `src/model.ts` defineix el model i els pendents; `src/data.ts` és la frontera de persistència; `src/App.tsx` i `src/ConcertForm.tsx` presenten la UI.
- No copiar ni consultar apps anteriors (`Documents/Artista` o `Documents/Escena`) com a base d'aquest projecte.
- Abans d'acabar un canvi de codi, executa `npm run build`.
