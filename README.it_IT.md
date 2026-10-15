<!--
EL-UI
Project lead and maintainer: ArmanEleven
This project builds on the Sanaei 3X-UI codebase. See LICENSE and upstream notices.
-->

<p align="center">
  <strong>EL-UI</strong>
</p>

<h1 align="center">EL-UI — Un livello di gestione basato sui ruoli per 3X-UI</h1>

<p align="center">
  <em>Creato e mantenuto da <a href="https://github.com/ArmanEleven">ArmanEleven</a></em>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fa_IR.md">فارسی</a> ·
  <a href="README.it_IT.md">Italiano</a> ·
  <a href="README.zh_CN.md">简体中文</a> ·
  <a href="README.ru_RU.md">Русский</a> ·
  <a href="README.tr_TR.md">Türkçe</a>
</p>

<p align="center">
  <img alt="Stato del progetto: sperimentale" src="https://img.shields.io/badge/status-experimental-orange">
  <img alt="Core: 3X-UI" src="https://img.shields.io/badge/core-3X--UI-blue">
  <img alt="Licenza: GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-informational">
</p>

**EL-UI** è un progetto open source guidato da **ArmanEleven**, nato per offrire un'esperienza di gestione più chiara e completa sulla base del codice di [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui). L'obiettivo non è sostituire il motore dei protocolli Xray: vogliamo preservare le funzionalità principali del pannello e sviluppare un livello di gestione separato per amministratori, ruoli, permessi, quote e visibilità operativa.

> [!WARNING]
> **EL-UI è in fase di sviluppo e non è una release pronta per la produzione.** La gestione multi-admin non è ancora collegata end-to-end all'autenticazione, all'autorizzazione delle API e all'interfaccia. Non usare questo ramo di sviluppo per gestire server di produzione o dati importanti.

## Obiettivi del progetto

- **Preservare il core:** mantenere le funzionalità 3X-UI esistenti per Xray, inbound, client, subscription, traffico e nodi.
- **Multi-admin reale:** assegnare a ogni amministratore un'identità indipendente, un ruolo, uno stato e un ambito di accesso applicabile.
- **Permessi basati sui ruoli:** usare gli ambiti espliciti `NONE`, `OWN` e `ALL`, negando per impostazione predefinita ciò che non è autorizzato.
- **Quote verificate dal server:** applicare limiti di utenti, traffico/dati, scadenza, HWID e altri vincoli nelle operazioni backend, non soltanto nei moduli dell'interfaccia.
- **Separazione della proprietà:** impedire a un amministratore di leggere o modificare dati fuori dall'ambito consentito dal suo ruolo.
- **Modifiche verificabili e reversibili:** introdurre migrazioni sicure, controlli di backup/ripristino, log operativi chiari e test di regressione.
- **Interfaccia dedicata:** sviluppare un'interfaccia accessibile e responsive, con supporto multilingue e layout da destra a sinistra.

## Stato attuale dello sviluppo

Il lavoro corrente si trova nel branch `feature/rbac-foundation`.

| Area | Stato |
|---|---|
| Codice sorgente del core 3X-UI nel branch di sviluppo | Presente; la validazione completa della release EL-UI è in sospeso |
| Modelli iniziali RBAC e controlli dei permessi | Aggiunti; i test unitari sono stati scritti |
| Modelli database separati per ruoli e amministratori | Aggiunti e registrati per la migrazione dello schema |
| Elenco dei modelli per migrazione SQLite ↔ PostgreSQL | Aggiornato con le nuove tabelle di gestione |
| Login e sessioni indipendenti degli amministratori | Non ancora implementati |
| Autorizzazione applicata alle API di gestione reali | Non ancora implementata |
| Interfaccia per gestire ruoli e amministratori | Non ancora implementata |
| Build completa, test d'integrazione e verifica degli aggiornamenti in sicurezza | In sospeso |

Un modello database o una schermata non rendono una funzionalità completa. Ogni funzione deve essere integrata nell'applicazione e verificata con test riproducibili. Lo stato completo della CI di questo branch non è ancora stato verificato.

## Funzionalità pianificate

### 1. Amministratori e ruoli

- Account Owner con controllo completo.
- Account indipendenti per gli amministratori secondari.
- Creazione, modifica, disattivazione e gestione degli account.
- Ruoli configurabili con permessi distinti per risorsa e operazione.
- Ambiti di accesso `NONE`, `OWN` e `ALL`.
- Portale amministrativo separato dalle operazioni riservate all'Owner.

### 2. Limiti e policy di accesso

- Numero massimo di utenti/client per amministratore.
- Limiti minimi e massimi per traffico/dati e intervalli di scadenza.
- Policy HWID e limiti di dispositivi per utente, quando supportati dal core.
- Liste di gruppi e template consentiti.
- Comportamento definito per gli amministratori limitati o disabilitati.
- Controlli lato server, con test sui valori limite e sulle richieste concorrenti.

### 3. Operatività e affidabilità

- Registro degli eventi amministrativi sensibili.
- Migrazioni database sicure e versionate.
- Test di backup e ripristino prima della release.
- Copertura della migrazione tra SQLite e PostgreSQL.
- Test d'integrazione per chiamate API dirette, isolamento tra proprietari, account disabilitati e quote.
- Documentazione chiara per installazione, aggiornamento, rollback e risoluzione dei problemi.

Queste sono mete del progetto, non una dichiarazione che tutte le funzioni siano già disponibili.

## Architettura

EL-UI usa il codice nativo di 3X-UI come core per i protocolli e Xray. Il livello di gestione previsto avrà confini espliciti, così le policy amministrative non aggireranno la logica nativa dei client e del runtime.

- **Core:** [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) — ciclo di vita di Xray, inbound, client, subscription e operazioni sui nodi.
- **Motore dei protocolli:** [Xray-core](https://github.com/XTLS/Xray-core).
- **Backend:** Go, Gin e GORM.
- **Frontend:** React, TypeScript, Vite e Ant Design.
- **Database ereditati dal core:** SQLite e PostgreSQL.
- **Riferimento per il comportamento RBAC:** concetti documentati pubblicamente in [PasarGuard](https://github.com/PasarGuard/panel). L'implementazione di EL-UI viene sviluppata in modo indipendente; ciò non implica il riutilizzo del suo codice.

Per ulteriori dettagli consulta la [proposta architetturale](docs/ELUI-ARCHITECTURE.md), l'[audit del codice sorgente](docs/SOURCE_AUDIT.md) e la [matrice di compatibilità delle funzionalità](docs/FEATURE_MATRIX.md).

## Sviluppo

Usa versioni degli strumenti coerenti con i manifest del repository. Il branch corrente dichiara Go 1.27.2 e, per il frontend, Node.js 26 o superiore e npm 11 o superiore.

Test Go:

```bash
go test ./...
```

Esegui i controlli frontend dalla cartella `frontend/`:

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

Sono comandi consigliati per chi contribuisce e **non** dimostrano che l'intero branch abbia già superato la CI. Esegui i test su database e server usa-e-getta; non provare migrazioni su un database di produzione.

## Sicurezza e integrità dei dati

- Applica i permessi nel backend: nascondere un pulsante non equivale ad autorizzare un'operazione.
- Applica i vincoli di proprietà nelle query del database, non soltanto nell'interfaccia.
- Non scrivere nei log password, token API, segreti delle subscription o dati sensibili non oscurati.
- Verifica migrazioni e ripristino con dati di prova prima del deployment.
- Conserva gli avvisi di copyright e rispetta le condizioni di licenza a monte; consulta [LICENSE](LICENSE).
- Per segnalare possibili vulnerabilità, usa ove possibile un canale privato; consulta [SECURITY.md](SECURITY.md).

## Guida del progetto e ringraziamenti

**Responsabile e maintainer del progetto:** [ArmanEleven](https://github.com/ArmanEleven).

EL-UI si basa sul lavoro dei progetti [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) e [Xray-core](https://github.com/XTLS/Xray-core). È importante attribuire correttamente il lavoro dei rispettivi maintainer e contributori. I comportamenti amministrativi documentati di PasarGuard sono studiati come riferimento funzionale.

## Licenza

La distribuzione di EL-UI deve preservare i requisiti di licenza e gli avvisi del codice sorgente a monte. Prima di modificare o ridistribuire il progetto, consulta [LICENSE](LICENSE).

---

<p align="center">
  <sub>Progettato e mantenuto da <a href="https://github.com/ArmanEleven">ArmanEleven</a> · Sviluppo per fasi, con la correttezza prima delle promesse.</sub>
</p>
