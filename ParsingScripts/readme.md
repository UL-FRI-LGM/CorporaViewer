# Navodila za postavitev spletne aplikacije Corpora Viewer

Ta dokument vsebuje navodila za postavitev spletne aplikacije Corpora Viewer. Sestavljen je iz 6 korakov, ki so potrebni
za postavitev spletne aplikacije. Ti koraki so:

1. postavitev Elasticsearch podatkovne baze z Dockerjem
2. dodajanje metapodatkov v XML (koordinate)
3. parsanje zapisnikov (XML -> JSON)
4. uvažanje podatkov v Elasticsearch podatkovno bazo.
5. priprava PDF datotek in naslovnih slik
6. postavitev spletne aplikacije

Vsak od korakov je podrobneje opisan v nadaljevanju. Rezultat izvedbe vseh korakov je postavljena spletna aplikacija, ki
je pripravljena za nadaljnji razvoj.

## 1. Postavitev Elasticsearch podatkovne baze z Dockerjem

Za izvedbo tega koraka si je potrebno namestiti Docker. Namestitev Dockerja je odvisna od operacijskega sistema, zato prilagam povezave do navodil za namestitev Dockerja za:
- [poljubno Linux distribucijo (Docker Engine)](https://docs.docker.com/engine/install/)
- [Windows (Docker Desktop)](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Mac (Docker Desktop)](https://docs.docker.com/desktop/setup/install/mac-install/)

V primeru, da sledite navodilom za namestitev Dockerja na poljubni Linux distribuciji, je potrebno poleg Dockerja še namestiti Docker Compose. Navodila za namestitev Docker Compose so na voljo [tukaj](https://docs.docker.com/compose/install/linux/#install-using-the-repository).

Najprej je potrebno postaviti Elasticsearch podatkovno bazo. To storimo s pomočjo orodja Docker Compose. To storimo, tako da se premaknemo v mapo, kjer se nahaja datoteka `docker-compose.yml` in izvedemo ukaz:

```bash
docker compose up -d
```

Počakamo, da se postopek zaključi. Ko je postopek zaključen, bi morali imeti postavljeno Elasticsearch podatkovno bazo s
tremi nodi (`es01`, `es02` in `es03`) in Kibano vmesnikom (le ta se ponavadi zaganja več časa).

V `.env` datoteki lahko spreminjamo nastavitve za Elasticsearch podatkovno bazo (vrata, verzijo Elasticsearch-a,
omejitev pomnilnika, itd.).

Priporočljivo je, da to podatkovno bazo postavljamo na mašini, ki ima vsaj 8 GB RAM-a, saj je privzeta konfiguracija vsakemu NODE-u dodeli 1 GB RAM-a.

## 2. Dodajanje metapodatkov v XML (koordinate)

Zatem je potrebno v XML datoteke dodati koordinate v XML datoteke, ki jih bomo potrebovali za prikaz iskanih besed v spletni
aplikaciji. Za izvedbo tega koraka boste potrebovali tako [XML datoteke](https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1824/Kranjska-xml.zip?sequence=5&isAllowed=y) kot tudi [PDF datoteke](https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1824/Kranjska-pdf.zip?sequence=3&isAllowed=y).

Za poganjanje skripte `dzk-add-metadata.py` potrebujemo **Python 3.9**, saj v nasprotnem primeru ne bo delovala zaradi
knjižnice `edlib`.

Z ukazom `pip install -r requirements.txt` namestimo vse potrebne knjižnice za izvedbo skripte.

Pred poganjanjem skripte je potrebno nastaviti spodnje spremenljivke v skripti:

1. `PATH_TO_XML_FILES` - pot do XML datotek
2. `PATH_TO_PDF_FILES` - pot do PDF datotek
3. `PATH_TO_OUTPUT` - pot do izhodne mape, kamor bomo shranili XML datoteke z dodanimi koordinatami
4. `VISUALIZE_COORDINATES_FROM_XML` - če želimo vizualizirati koordinate v PDF datoteki, nastavimo na `True`, sicer na
   `False` (opcijsko)
5. `VISUALIZATION_FILE` - ime izhodne PDF datoteke, kjer bomo shranili vizualizacije koordinate (opcijsko, če je `VISUALIZE_COORDINATES_FROM_XML` nastavljena na `True`)
6. `SKIP_FILES_TO` - število datotek, ki jih želimo preskočiti (opcijsko)
7. `MAX_FILES` - število datotek, ki jih želimo obdelati (opcijsko)
8. `PRINT_ALIGNMENT` - če želimo izpisati poravnavo, nastavimo na `True`, sicer na `False` (opcijsko)

Ko so spremenljivke nastavljene, lahko skripto poženemo z ukazom `python dzk-add-metadata.py`.

## 3. Parsanje zapisnikov (XML -> JSON)

Zatem je potrebno zapisnike pretvoriti iz XML formata v JSON format. Za to uporabimo skripto `dzk-parser.py`. Ker je ta
postopek precej dolgotrajen, je priporočljivo, da se skripta poganja na strežniku.

Pred poganjanjem je potrebno:

1. posebej zagnati knjižnico libretranslate, ki se uporablja za prevajanje, to naredimo z ukazom `libretranslate`
2. posebej namestiti slovenski in nemški jezikovni model s sledečimi ukazi:

```bash
python -m spacy download de_core_news_md
python -m spacy download sl_core_news_md
```

Pred poganjanjem skripte je potrebno nastaviti nekaj spremenljivk v skripti:

1. `PATH_TO_XML_FILES` - pot do XML datotek, ki vsebujejo kooridnate
2. `PATH_TO_JSONL_FILES` - pot do izhodne mape, kamor bomo shranili JSONL datoteke
3. `PATH_TO_ATTENDEES_TEXT_FILE` - pot do datoteke, ki vsebuje seznam udeležencev (za obdelavo seznama udeležencev je
   potrebno v kodi odstraniti komentar funkcije `parse_poslanci`)
4. `PATH_TO_PLACES_XLSX_FILE` - pot do datoteke, ki vsebuje seznam krajev (za obdelavo seznama krajev je potrebno v kodi
   odstraniti komentar funkcije `parse_krajevna_imena`)
5. `PLACES_SHEET_NAME` - ime lista v Excel datoteki, ki vsebuje seznam krajev

Ko so spremenljivke nastavljene, lahko skripto poženemo z ukazom `python dzk-parser.py`.

Skripta bo za vsak zapisnik generirala 3 JSONL datoteke:

1. `_meeting.jsonl` - se uporablja za prvotno iskanje in prikaz transkripta zapisnika
2. `_sentences.jsonl` - se uporablja za iskanje po frazah v zapisniku
3. `_words.jsonl` - se uporablja za označevanje besed v zapisniku

## 4. Uvažanje podatkov v Elasticsearch podatkovno bazo

Naslednji korak je uvoz podatkov v Elasticsearch podatkovno bazo. Za to uporabimo skripto `dzk-upload-to-elasic.py`.

Pred poganjanjem skripte je potrebno nastaviti nekaj spremenljivk v skripti:

1. `PATH_TO_JSONL_FILES` - pot do mape kjer se nahajajo JSONL (`_meeting.jsonl`, `_sentences.jsonl`, `_words.jsonl`)
   datoteke
2. `DELETE_INDEX_IF_EXISTS` - če želimo izbrisati index v Elasticsearch, če ta že obstaja, nastavimo na `True`, sicer na
   `False`
3. `SKIP_FILES_TO` - število datotek, ki jih želimo preskočiti (opcijsko)
4. `MAX_FILES` - število datotek, ki jih želimo obdelati (opcijsko)

Ko so spremenljivke nastavljene, lahko skripto poženemo z ukazom `python dzk-upload-to-elasic.py`.

Zna se zgoditi, da se, kdaj pojavi `ReadTimeoutError:` izjema. V tem primeru je potrebno: 
1. nastaviti spremenljivko `DELETE_INDEX_IF_EXISTS` na `False` (v nasprotnem primeru bo skripta izbrisala indexe in vsi uvoženi podatki bodo izgubljeni) 
2. nastaviti spremenljivko `SKIP_FILES_TO` na število, ki predstavlja število že uvoženih datotek iz izpisa (v primeru, da nam program izpiše `progress: 1076/1936` in se potem ustavi, nastavimo `SKIP_FILES_TO` na 1076)
3. ponovno poženemo skripto

## 5. Priprava PDF datotek in naslovnih slik

Predzadnji korak je preimenovanje PDF datotek in priprava naslovnih slik. PDF, ki ste jih naložili s spletna je potrebno pravilno preimenovati in za vsako PDF datoteko ustvariti naslovno sliko.

Za preimenovanje PDF datotek uporabite skripto `dzk-prepare-data.py`.

Pred poganjanjem skripte je potrebno nastaviti nekaj spremenljivk v skripti:
1. `SOURCE_DIRECTORY` - pot do mape, kjer se nahajajo PDF datoteke naložene s spletna
2. `DESTINATION_DIRECTORY` - pot do mape, kamor bomo shranili preimenovane PDF datoteke

Ko so spremenljivke nastavljene, lahko skripto poženemo z ukazom `python dzk-prepare-data.py`.

Skripta bo v izhodni mapi ustvarila sledečo strukturo:

```
DZK
├── Kranjska-pdf
└── thumbnails
```

V mapi `Kranjska-pdf` se nahajajo preimenovane PDF datoteke, v mapi `thumbnails` pa se nahajajo naslovne slike.


## 6. Postavitev spletne aplikacije

Zadnji korak je postavitev spletne aplikacije. Najprej je potrebno klonirati [repozitorij spletne aplikacije](https://github.com/cadezd/CorporaViewer), v katerem se nahajta zaledni del (korenski direktorij - mapa `CorporaViewer`) in čelni del (mapa `vue`) spletne aplikacije, s spodnjim ukazom:

```bash
git clone https://github.com/cadezd/CorporaViewer.git
cd CorporaViewer
```

Najprej je potrebno namestiti vse potrebne knjižnice za zaledni del aplikacije. To storimo z ukazom `npm install`, ki ga poženemo v korenskem direktoriju (mapa `CorporaViewer`) spletne aplikacije.
Potem je potrebno v korenskem direktoriju spletne aplikacije ustvariti datoteko `.env` in vanjo dodati naslednje spremenljivke:

```
PATH_TO_DATA="<path_to_data_directory>"
MEETINGS_INDEX_NAME=meetings-index
WORDS_INDEX_NAME=words-index
SENTENCES_INDEX_NAME=sentences-index
```

`<path_to_data_directory>` je potrebno zamenjati z absolutno potjo do direktorija, v katerem se nahaj mapa `DZK`.
Zatem lahko poženemo zaledni del spletne aplikacije z ukazom `npm start`.

Potem se premaknemo v mapo `vue` (čelni del aplikacije) z ukazom `cd vue` in ponovno namestimo vse potrebne knjižnice z ukazom `npm install`.
Potem je potrebno tudi v mapi `vue` ustvariti datoteko `.env` in vanjo dodati naslednje spremenljivke:

```
VUE_APP_API_URL="http://localhost:3000/api"
```
Nazadnje je potrebno zagnati še čelni del spletne aplikacije. To storimo z ukazom `npm run serve`, ki ga poženemo v mapi `vue`. 
Aplikacija je dostopna na sledečem naslovu: `http://localhost:8080/`.

