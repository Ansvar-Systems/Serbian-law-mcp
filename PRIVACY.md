# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Serbian bar association rules.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Serbian bar rules (AKS — Advokatska komora Srbije) require strict confidentiality (advokatska tajna) and data processing controls

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/serbian-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/serbian-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://serbian-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text (tekst propisa), provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Serbia)

### Bar Association of Serbia Rules

Serbian lawyers (advokati) are bound by strict confidentiality rules under the Law on Advocacy (Zakon o advokaturi) and the Kodeks profesionalne etike advokata of the Bar Association of Serbia (Advokatska komora Srbije — AKS).

#### Advokatska Tajna (Attorney Secrecy)

- All client communications are privileged
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Breach of confidentiality may result in disciplinary proceedings (disciplinski postupak)

### Serbian Data Protection Law

Under the **Serbian Personal Data Protection Act (Zakon o zaštiti podataka o ličnosti — ZZPL, 2018)**, which is harmonized with the GDPR:

- You are the **Data Controller** (Rukovalac)
- AI service providers (Anthropic, Vercel) may be **Data Processors** (Obrađivač)
- A **Data Processing Agreement** (Ugovor o obradi podataka) may be required when processing client personal data
- Ensure adequate technical and organizational measures (tehničke i organizacione mere)
- The Commissioner for Information of Public Importance and Personal Data Protection (Poverenik za informacije od javnog značaja i zaštitu podataka o ličnosti, poverenik.rs) oversees compliance

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does Article 154 of the Serbian Law on Obligations (Zakon o obligacionim odnosima) say about damages?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties for corruption under Serbian criminal law (Krivični zakonik)?"
```

- Query pattern may reveal you are working on a specific type of matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details before querying
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases (Paragraf Lex) with proper data processing agreements

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms (Individualni Advokati / Male Kancelarije)

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (Paragraf Lex) with proper data agreements

### For Large Firms / Corporate Legal (Advokatska Društva / Pravne Službe)

1. Negotiate Data Processing Agreements with AI service providers
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns

### For Government / Public Sector (Organi Javne Vlasti)

1. Use self-hosted deployment, no external APIs
2. Follow Serbian government IT security requirements
3. Air-gapped option available for classified matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/Serbian-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **Poverenik Guidance**: Consult the Commissioner for Personal Data Protection (poverenik.rs) for ZZPL compliance guidance
- **AKS Guidance**: Consult the Bar Association of Serbia (advokatska-komora.rs) for professional ethics guidance on AI tools

---

**Last Updated**: 2026-03-06
**Tool Version**: 1.0.0
