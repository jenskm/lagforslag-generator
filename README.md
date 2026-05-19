# Lagforslag-generator

Et lite verktøy som hjelper trenere og foreldre i barneklubber med å sette
sammen lag til turneringer. Du legger inn spillerne en gang per sesong,
og verktøyet genererer flere alternative lagsammensetninger basert på
hvem som deltar, hvilke tidspunkter de er tilgjengelige, og en rekke
balanseringskrav.

Alt kjører lokalt i nettleseren. Ingen pålogging, ingen skytjeneste,
ingen kostnad.

## Prøve det

Den enkleste måten er å åpne den publiserte versjonen:

**https://jenskm.github.io/lagforslag-generator/**

All data lagres lokalt i din egen nettleser, ingenting sendes til en
server.

## Kjøre lokalt

Hvis du heller vil kjøre verktøyet selv (lokalt): last ned eller klon repoet og
åpne `index.html` i en hvilken som helst moderne nettleser. Det er
ingen avhengigheter og ingen byggesteg.

## Funksjoner

- Administrer spillere, grupper (skoler) og trenere
- Hver spiller har nummer, navn, gruppe, ferdighetsnivå (1 til 5) og en
  Ja/Nei-markering for om de kan stille som lånespiller på andre lag
- Import og eksport av spillerlista som CSV
- Turneringsoppsett med antall lag, min/maks spillere per lag, kamplengde
  og kamptider per lag
- Spiller- og trenertilgjengelighet som tidsintervall (`HH:MM - HH:MM`)
- Genererer fem alternative lagforslag, rangert etter brudd på krav
- Eksport av et lagforslag til CSV (åpner direkte i Excel)
- JSON-sikkerhetskopi av alle data

## Hvordan algoritmen fungerer

Randomisert grådig tilordning kjøres mange ganger med ulike seeds. Hver
løsning skåres på følgende krav:

**Harde krav (må oppfylles, ellers ingen plassering):**

- Spilleren må være tilgjengelig på alle lagets kamper
- Lagstørrelsen må være innenfor min og maks satt i oppsettet
- Hvert lag må ha minst en spiller med tilgjengelig forelder-trener
  (når det finnes deltakende trenere)

**Myke krav (påvirker skåren, brudd flagges):**

- Lagenes ferdighetssnitt skal være nær snittet i deltakerpoolen
- Hver spiller skal ha minst en lagkamerat fra samme gruppe
- Lagene bør være omtrent like store

De fem beste, distinkte løsningene presenteres. For hvert forslag
listes også potensielle lånespillere fra andre lag (kun spillere som er
markert som "Kan lånes").

## CSV-format for spillere

```csv
nr,navn,gruppe,ferdighet,kan_laanes
1,Ola Nordmann,Skole A,3,Ja
2,Kari Hansen,Skole B,2,Nei
```

`kan_laanes` aksepterer Ja/Nei, true/false eller 1/0. Kolonnen er
valgfri og defaulter til Nei om den mangler.

## Datalagring

All data ligger i nettleserens egen lagring (localStorage). Bruk
JSON-eksport i Data-fanen for å ta sikkerhetskopi eller flytte data til
en annen maskin.

## Status

Tidlig versjon laget for testing og innspill. Tilbakemeldinger om
mangler, feil eller endringer er velkomne.

## Lisens

Lisensiert under [GNU AGPL-3.0-or-later](LICENSE). Kort fortalt: du kan
fritt bruke, modifisere og distribuere koden, men hvis du modifiserer
verktøyet og gjør det tilgjengelig for andre (også som webtjeneste),
må modifikasjonene gjøres tilgjengelige under samme lisens.

Copyright (C) 2026 Jens Kilde Mjelva
