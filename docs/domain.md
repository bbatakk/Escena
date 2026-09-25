# Domini i regles del concert

## Fitxa

`Concert` té id, títol, data, estat, ubicació i catxet acordat/cobrat. `ConcertDetails` conté les dades opcionals: acord, contacte, equip, horaris, logística, hospitalitat, documents, setlist, material, passis, imports de tancament i notes. Definicions TypeScript: `src/model.ts`.

La discogràfica és opcional i es configura per banda amb nom i trams ordenats de llindar «supera X € → Y %». A cada concert s’indica qui l’ha gestionat: banda, discogràfica o per concretar. En seleccionar discogràfica, la fitxa copia el nom i els trams vigents perquè els canvis futurs no alterin concerts pactats. El percentatge aplicable és el del tram més alt superat estrictament pel **total cobrat** i s’aplica sobre tot aquest import, sense escala progressiva; el net és brut cobrat menys comissió. Per exemple, 1.200 € pactats i 600 € cobrats amb trams >500 € al 15 % i >1.000 € al 20 % donen 90 € de comissió real i 510 € nets cobrats; la previsió del pactat és 240 € de comissió i 960 € nets. Si la banda gestiona el concert, la comissió és zero. Les fitxes anteriors sense gestor no s’atribueixen automàticament al segell: si la banda té discogràfica, els seus catxets cobrats queden pendents de classificar abans de sumar-los a Tresoreria.

Estats del concert: **en converses → reservat → confirmat → realitzat**, amb **cancel·lat** com a sortida possible. L'usuari tria l'estat; «realitzat» no implica «cobrat».

Sopar/allotjament: **pendent de saber / sí / no**. Un «sí» al sopar compta com a confirmat sense exigir detalls. L’allotjament «sí» necessita adreça per considerar-se concretat; un «no» no és un pendent. Documents: direcció **enviar/rebre** i estat **pendent/fet/no cal**. L'enllaç, quan existeix, és a un fitxer allotjat en un servei extern; «fet» és una confirmació de la banda, no una comprovació automàtica de lliurament.

Un document també pot tenir `storagePath` i `fileName`: el fitxer és al bucket privat `concert-documents` sota `band_id/concert_id/document_id/`. Una URL temporal signada permet obrir-lo només després d'autenticar-se. Pujar un fitxer no equival a enviar-lo o rebre'l; els pendents segueixen derivant-se de l'estat del document. La pujada només es fa després de desar la fitxa.

`BandDocument` és un recurs reutilitzable de la banda (nom, enllaç i/o fitxer privat); els seus fitxers viuen a `band_id/shared/document_id/`. Incorporar-lo a un concert en copia les referències i en crea una entrada amb estat propi, inicialment «pendent d'enviar». Els fitxers compartits no s'eliminen quan es treu l'entrada d'un concert; arxivar el recurs tampoc no invalida concerts previs. Si el recurs se substitueix, les fitxes anteriors conserven la versió anterior.

Horaris: entrades lliures amb hora, nom i lloc; no hi ha una seqüència fixa. Material: entrades del concert amb `loaded` per fer la comprovació física de càrrega.

## Pendents derivats

`getPending(concert)` és l'única font de veritat d'aquesta primera versió. Mostra: reserva sense confirmar; concert confirmat sense sala ni adreça; allotjament indicat com a «sí» sense adreça; documents amb nom i estat pendent; concert realitzat amb catxet cobrat inferior al pactat. Un sopar confirmat sense detalls no genera cap pendent. Un concert cancel·lat no mostra pendents. Cap altre camp buit genera un avís per defecte. Els pendents desapareixen en actualitzar les dades, sense caselles manuals.

## Persistència actual

En Supabase, columnes per dades identificatives i econòmiques bàsiques; `details` JSONB per dades opcionals de la fitxa. Aquesta decisió afavoreix iterar la fitxa durant la prova inicial; abans d'afegir informes/inventari compartit es normalitzaran les dades transaccionals. `band_members` vincula cada compte a una banda i RLS impedeix llegir o editar concerts d'altres bandes.

`updated_at` protegeix l'edició simultània: si una fitxa ha canviat en un altre dispositiu, es rebutja desar una còpia antiga en comptes de sobreescriure-la silenciosament.

Les vendes de marxandatge redueixen l'estoc disponible. Els productes sense variants calculen `stock - vendes`; els productes amb talles comproven tant l'estoc de cada talla com el total. La base de dades també aplica un trigger per evitar sobrepassar l'estoc en vendes simultànies.

Les vendes de marxandatge s'inclouen automàticament als ingressos totals i al balanç de Tresoreria, però continuen sent registres separats dels moviments manuals. No s'han de tornar a introduir manualment, perquè es duplicarien.

El catxet **net cobrat** de cada concert classificat s’inclou també automàticament en el balanç de Tresoreria. El catxet pactat no és cobrament ni moviment: no s’ha de registrar manualment com a ingrés una segona vegada. Els moviments manuals continuen sent independents.

Els productes de marxandatge poden tenir variants de talla, cadascuna amb estoc propi. Les vendes guarden la talla triada i redueixen l'estoc d'aquesta variant; els productes sense talles continuen utilitzant l'estoc general existent.

Els recursos de banda (`BandPerson`, `BandMaterial`, `SetlistTemplate`) són catàlegs reutilitzables. La fitxa copia les seleccions al concert: modificar persones, material o una plantilla no canvia concerts anteriors. Les dades antigues de contacte, equip, material i setlist continuen sent vàlides.

Quan no hi ha xarxa, es conserva una còpia local de la llista de concerts i les edicions de la fitxa es posen en una cua local; en tornar la connexió es reintenten. La cua actual és especialment pensada per al material, no és encara una sincronització offline completa de totes les entitats.
