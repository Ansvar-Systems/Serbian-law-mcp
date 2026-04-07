# Serbian Law MCP Server

**The Paragraf.rs alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fserbian-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/serbian-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Serbian-law-mcp?style=social)](https://github.com/Ansvar-Systems/Serbian-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Serbian-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Serbian-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Serbian-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Serbian-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-47%2C041-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **822 Serbian laws** -- from Закон о заштити података о личности (Personal Data Protection Act) and Кривични законик (Criminal Code) to Закон о раду (Labour Law), Закон о привредним друштвима (Companies Act), and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Serbian legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Serbian legal research means navigating Paragraf.rs, the Службени гласник (Official Gazette), the official Pravno-Informacioni Sistem (PIS), and EUR-Lex -- manually tracking which EU acquis has been adopted into Serbian law. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking obligations under Serbian data protection law or EU-aligned regulations
- A **legal tech developer** building tools on Serbian or Western Balkans law
- A **researcher** tracing EU accession alignment across Serbian legislation

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Serbian law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-rs/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add serbian-law --transport http https://mcp.ansvar.eu/law-rs/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serbian-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-rs/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "serbian-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-rs/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/serbian-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "serbian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/serbian-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "serbian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/serbian-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally (in Serbian/Cyrillic or English):

- *"Шта каже Закон о заштити података о личности у члану 12 о условима за обраду?"*
- *"Да ли је Закон о раду тренутно на снази?"*
- *"Претражи прописе о заштити личних података у српском законодавству"*
- *"Које EU директиве имплементира Закон о заштити података о личности?"*
- *"Шта каже Кривични законик о рачунарском криминалу?"*
- *"Пронађи одредбе о оснивању привредних друштава у Закону о привредним друштвима"*
- *"Валидирај цитат 'члан 46 Закон о заштити података о личности'"*
- *"Изгради правни став о уговорној одговорности по српском праву"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Laws** | 822 laws | Serbian legislation from the official PIS database |
| **Provisions** | 47,041 sections | Full-text searchable with FTS5 |
| **Preparatory Works** | 314,090 documents | Predlozi zakona and образложења |
| **Database Size** | Optimized SQLite | Portable, pre-built |
| **Daily Updates** | Automated | Freshness checks against official sources |

**Verified data only** -- every citation is validated against official sources (Правно-информациони систем, Службени гласник). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from the official Pravno-Informacioni Sistem (www.pravno-informacioni-sistem.rs) and Службени гласник
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by law identifier + article number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
PIS / Службени гласник --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                             ^                        ^
                      Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search Paragraf.rs by law name | Search by plain Serbian: *"заштита података личности"* |
| Navigate multi-chapter laws manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "Да ли је овај закон на снази?" -> check manually | `check_currency` tool -> answer in seconds |
| Find EU acquis basis -> dig through EUR-Lex | `get_eu_basis` -> linked EU directives instantly |
| Check 5+ sites for updates | Daily automated freshness checks |
| No API, no integration | MCP protocol -> AI-native |

**Traditional:** Search PIS -> Download PDF -> Ctrl+F -> Cross-reference with EU acquis -> Check EUR-Lex -> Repeat

**This MCP:** *"Које EU директиве стоје иза одредби Закона о заштити података о личности о безбедности обраде?"* -> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 search on 47,041 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by law identifier + article number |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from statutes and preparatory works |
| `format_citation` | Format citations per Serbian legal conventions |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `list_sources` | List all available laws with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Acquis Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations that a Serbian law implements (EU acquis alignment) |
| `get_serbian_implementations` | Find Serbian laws implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Serbian implementation counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check acquis alignment status of Serbian laws against EU directives |

---

## EU Accession Context

Serbia is an EU accession candidate implementing the EU acquis as part of the accession process (candidate status granted 2012, accession negotiations ongoing). This means:

- **GDPR** is transposed into Serbian law via Закон о заштити података о личности (2018) -- one of the most comprehensive GDPR implementations in the Western Balkans
- **NIS Directive** principles are reflected in Serbian cybersecurity legislation
- **AML/CFT Directives** shape Serbian anti-money laundering law (Закон о спречавању прања новца)
- Serbia is actively aligning domestic legislation with the EU acquis across 35 negotiating chapters
- The Stabilisation and Association Agreement (SAA) with the EU provides the legal framework for alignment

The EU acquis integration tools provide bi-directional lookup between Serbian laws and their EU basis -- essential for tracking accession alignment.

> **Note:** Serbia is not an EU member state. EU law does not apply directly in Serbia. Cross-references reflect acquis alignment and SAA obligations, not formal EU membership transposition. Alignment status changes as Serbia advances accession negotiations.

---

## Data Sources & Freshness

All content is sourced from authoritative Serbian legal databases:

- **[Pravno-Informacioni Sistem (PIS)](https://www.pravno-informacioni-sistem.rs/)** -- Official Serbian legal information system
- **[Службени гласник](https://www.slglasnik.com/)** -- Official Gazette of the Republic of Serbia

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Правно-информациони систем Републике Србије |
| **Retrieval method** | Official PIS database ingestion |
| **Language** | Serbian (Cyrillic and Latin scripts) |
| **Coverage** | 822 laws across all legal domains |
| **Last ingested** | 2026-02-25 |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors official sources for changes:

| Source | Check | Method |
|--------|-------|--------|
| **Law amendments** | PIS date comparison | All 822 laws checked |
| **New laws** | Службени гласник publications | Diffed against database |
| **Preparatory works** | Предлози закона feed | New proposals detected |
| **EU acquis staleness** | Git commit timestamps | Flagged if >90 days old |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Serbian government databases (PIS, Службени гласник). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **EU acquis cross-references** reflect alignment status, not formal EU membership transposition
> - **Accession status** is dynamic -- legislative alignment changes as Serbia advances negotiations

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for guidance on professional use in accordance with Advokatska komora Srbije standards.

---

## Documentation

- **[EU Acquis Integration Guide](docs/EU_INTEGRATION_GUIDE.md)** -- Detailed EU cross-reference documentation
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Serbian-law-mcp
cd Serbian-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest laws from PIS database
npm run build:db                  # Rebuild SQLite database
npm run sync:prep-works           # Sync предлози закона
npm run check-updates             # Check for amendments
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Colombia, Denmark, Finland, France, Germany, Ireland, Italy, Japan, Netherlands, Norway, Slovenia, South Korea, Sweden, Taiwan, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Врховни суд, Уставни суд)
- EU acquis alignment tracking (negotiating chapter mapping)
- Historical statute versions and amendment tracking
- Latin script variants for all provisions

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (822 laws, 47,041 provisions)
- [x] Preparatory works (314,090 documents)
- [x] EU acquis integration tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law expansion (Врховни суд archive)
- [ ] Уставни суд decisions
- [ ] Historical statute versions (amendment tracking)
- [ ] Full negotiating chapter mapping

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{serbian_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Serbian Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Serbian-law-mcp},
  note = {822 Serbian laws with 47,041 provisions and 314,090 preparatory works}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Република Србија (public domain -- official PIS database)
- **EU Acquis Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server started as our internal reference tool for Serbian law and EU accession tracking -- turns out everyone building for the Western Balkans market has the same research frustrations.

So we're open-sourcing it. Navigating 822 Serbian laws and tracking EU acquis alignment shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
