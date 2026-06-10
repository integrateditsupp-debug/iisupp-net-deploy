from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "invest-ns-submission"
SRC_APPENDIX = (
    ROOT
    / "procurement-downloads"
    / "invest-nova-scotia-standing-offer"
    / "extracted"
    / "1-Appendix A - Mandatory Submission Form fillable.pdf"
)
PROPOSAL_PDF = OUT / "IIS_InvestNovaScotia_INS2024-25-23_Proposal_DRAFT.pdf"
APPENDIX_PDF = OUT / "IIS_InvestNovaScotia_INS2024-25-23_Appendix_A_PREFILLED_UNSIGNED.pdf"
APPENDIX_FINAL_PDF = OUT / "IIS_InvestNovaScotia_INS2024-25-23_Appendix_A_SIGNED_FINAL.pdf"
QA_DIR = OUT / "qa"


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def bullet(items: list[str], styles) -> ListFlowable:
    return ListFlowable(
        [ListItem(p(item, styles["Body"]), leftIndent=12) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=18,
        bulletIndent=6,
    )


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(inch, 0.5 * inch, "Integrated IT Support Inc. | INS2024-25-23")
    canvas.drawRightString(7.5 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_proposal() -> Path:
    OUT.mkdir(parents=True, exist_ok=True)

    base = getSampleStyleSheet()
    styles = {
        "Title": ParagraphStyle(
            "IIS_Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=23,
            textColor=colors.HexColor("#163A5F"),
            spaceAfter=8,
            alignment=TA_LEFT,
        ),
        "Subtitle": ParagraphStyle(
            "IIS_Subtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#444444"),
            spaceAfter=14,
        ),
        "H1": ParagraphStyle(
            "IIS_H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=colors.HexColor("#2E74B5"),
            spaceBefore=14,
            spaceAfter=7,
        ),
        "H2": ParagraphStyle(
            "IIS_H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=colors.HexColor("#1F4D78"),
            spaceBefore=10,
            spaceAfter=5,
        ),
        "Body": ParagraphStyle(
            "IIS_Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            spaceAfter=6,
        ),
        "Small": ParagraphStyle(
            "IIS_Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#555555"),
            spaceAfter=4,
        ),
    }

    doc = SimpleDocTemplate(
        str(PROPOSAL_PDF),
        pagesize=LETTER,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.7 * inch,
        title="IIS Invest Nova Scotia Standing Offer Proposal",
        author="Integrated IT Support Inc.",
    )

    story = []
    story.append(p("Response to RSO #INS2024-25-23", styles["Title"]))
    story.append(
        p(
            "Standing Offer for Professional and Consulting Services and Certain Goods - Continuous Onboarding",
            styles["Subtitle"],
        )
    )

    meta = [
        ["Respondent", "Integrated IT Support Inc."],
        ["Primary Contact", "Ahmad Wasee, Founder and Senior AI Engineer"],
        ["Contact", "ahmad.wasee@iisupp.net | +1 647-581-3182"],
        ["Address", "30 Fothergill Court, Whitby, Ontario L1P 1L4, Canada"],
        ["Website", "https://iisupp.net"],
        ["Service Function Category", "Information Technology Goods & Services"],
        [
            "Selected Service Functions",
            "Software/application consultation and development; network, server and IT security consultation; privacy/risk governance advisory",
        ],
        ["Submission Date", date.today().strftime("%B %-d, %Y") if sys.platform != "win32" else date.today().strftime("%B %#d, %Y")],
    ]
    meta = [[p(label, styles["Small"]), p(value, styles["Small"])] for label, value in meta]
    t = Table(meta, colWidths=[1.65 * inch, 4.85 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F2F4F7")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1F4D78")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("LEADING", (0, 0), (-1, -1), 10.5),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CCCCCC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story += [t, Spacer(1, 12)]

    story.append(p("Executive Summary", styles["H1"]))
    story.append(
        p(
            "Integrated IT Support Inc. (IIS) is applying for the Information Technology Goods & Services category. IIS is a senior-led Ontario technology firm focused on applied AI, workflow automation, IT service management, Microsoft cloud support, endpoint and identity operations, and practical security/privacy governance. The proposed delivery model is deliberately focused: IIS will accept only future statements of work that align with Ahmad Wasee's demonstrated enterprise IT, automation, ITSM, Microsoft 365/Azure, and AI implementation experience, with qualified subcontractor support used where scale or specialist review is required.",
            styles["Body"],
        )
    )
    story.append(
        p(
            "This response is written for standing-offer eligibility. It does not claim hardware resale capacity, Drupal website development, legal privacy opinions, managed SOC/MDR services, or named subcontractor commitments that have not been separately approved.",
            styles["Body"],
        )
    )

    story.append(p("B.4.1 Corporate Profile", styles["H1"]))
    story.append(
        p(
            "Integrated IT Support Inc. was established in 2023 and is headquartered in Whitby, Ontario. IIS serves small and mid-sized organizations and procurement buyers that need senior technical execution without unnecessary delivery overhead. The company is led by Ahmad Wasee, Founder and Senior AI Engineer, who brings more than 13 years of enterprise technology experience across regulated financial services, public-sector and healthcare environments, and professional-services support operations.",
            styles["Body"],
        )
    )
    story.append(
        p(
            "IIS uses a senior-led delivery model supported by a flexible specialist bench. Ahmad remains accountable for scope control, client communication, delivery quality, escalation, technical governance, and final work-product review. When a statement of work requires additional capacity or role-specific expertise, IIS can assign qualified subcontractors or partner resources under IIS direction, subject to Invest Nova Scotia's procurement, confidentiality, security, and approval requirements.",
            styles["Body"],
        )
    )
    story.append(
        bullet(
            [
                "Head office: Whitby, Ontario, Canada.",
                "Primary markets served: small and mid-sized businesses, financial services, regulated operations, professional services, healthcare-adjacent support environments, and public-sector-aligned buyers.",
                "Core operating areas: AI readiness and implementation support, workflow automation, ITSM and support process improvement, Microsoft 365/Azure/Entra/Intune support, knowledge-base and runbook development, and privacy/security-aware technical advisory.",
                "Capacity model: senior accountable lead plus qualified surge support for technical writing, implementation, QA, privacy/security review, and project coordination where required.",
            ],
            styles,
        )
    )

    story.append(p("B.4.2 Goods/Services Offered", styles["H1"]))
    story.append(
        p(
            "IIS is applying under the Information Technology Goods & Services category for service functions where the respondent's experience is directly relevant. IIS will not pursue a future statement of work if the mandatory requirements fall outside these capabilities unless qualified and approved partner/subcontractor support is formally in place.",
            styles["Body"],
        )
    )

    services = [
        [
            p("Selected function", styles["Small"]),
            p("IIS offering", styles["Small"]),
            p("Fit and limits", styles["Small"]),
        ],
        [
            p("Software / application licensing consultation & development", styles["Small"]),
            p("AI workflow discovery, automation pilots, Microsoft 365/Copilot/Azure OpenAI advisory, ServiceNow ITSM workflow support, API/webhook integration, prompt and knowledge-base engineering, support-copilot implementation, documentation and training.", styles["Small"]),
            p("Strong fit for advisory, pilot, workflow, documentation, and implementation support. IIS will avoid unsupported product-reseller claims unless an approved supplier arrangement exists.", styles["Small"]),
        ],
        [
            p("Network, server & IT security consultation services", styles["Small"]),
            p("Endpoint, identity, Entra ID, Intune, Microsoft Defender, Active Directory, cloud operations, incident/change/problem management, runbook development, operational reporting, and control-aware support process design.", styles["Small"]),
            p("Strong fit for IT operations advisory and practical implementation support. IIS is not claiming a managed SOC, penetration-testing lab, or hardware resale operation.", styles["Small"]),
        ],
        [
            p("Privacy impact / risk governance consultation", styles["Small"]),
            p("AI/data workflow risk assessment, privacy-aware process design, access-control review, documentation of safeguards, audit-ready change evidence, responsible AI implementation guidance, and technical risk registers.", styles["Small"]),
            p("Fit for technical/privacy-aware advisory and documentation. IIS will obtain specialist/legal review where a formal legal opinion, statutory privacy officer sign-off, or regulated audit certification is required.", styles["Small"]),
        ],
    ]
    st = Table(services, colWidths=[1.75 * inch, 3.0 * inch, 1.75 * inch], repeatRows=1)
    st.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F4F7")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.2),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CCCCCC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story += [st, Spacer(1, 8)]

    story.append(p("Typical Deliverables", styles["H2"]))
    story.append(
        bullet(
            [
                "AI and workflow readiness assessments, including process inventory, automation candidates, risk/dependency notes, and prioritized implementation roadmap.",
                "Configuration and implementation support for approved Microsoft 365, Entra ID, Intune, Azure/OpenAI, ServiceNow, web/API, and support-process workflows.",
                "Runbooks, SOPs, support knowledge-base articles, training guides, user adoption materials, and executive-ready status summaries.",
                "Operational reports and dashboards for incident trends, service desk quality, SLA/KPI visibility, change evidence, and support workflow bottlenecks.",
                "Privacy/security-aware technical notes covering data flows, access controls, AI/tool-use safeguards, retention considerations, and escalation points for specialist review.",
            ],
            styles,
        )
    )

    story.append(p("Delivery Methodology", styles["H2"]))
    story.append(
        p(
            "For future statements of work, IIS uses a practical delivery method designed for short-term consulting assignments: confirm the business objective, validate constraints, map the current workflow, identify risks and dependencies, build the smallest useful implementation or advisory deliverable, test with users, document the handoff, and review measurable outcomes. This approach is well suited to standing-offer call-ups because it keeps the work bounded while still producing usable operational artifacts.",
            styles["Body"],
        )
    )
    story.append(
        bullet(
            [
                "Discovery: clarify stakeholders, data sensitivity, current-state process, tools, pain points, and acceptance criteria.",
                "Design: map target workflow, role responsibilities, technical requirements, privacy/security controls, and implementation options.",
                "Build/advisory: produce approved automation, configuration support, knowledge artifacts, governance notes, or implementation plan.",
                "Validate: test with users or technical owners, capture issues, refine deliverables, and document residual risks.",
                "Transfer: provide final deliverables, runbooks, training notes, and support/escalation recommendations.",
            ],
            styles,
        )
    )

    story.append(p("B.4.3 Skills and Expertise", styles["H1"]))
    story.append(p("Key Personnel: Ahmad Wasee, Founder and Senior AI Engineer", styles["H2"]))
    story.append(
        p(
            "Ahmad Wasee is the senior accountable lead for IIS technology delivery. His background combines hands-on AI engineering, enterprise IT operations, ITSM leadership, Microsoft cloud and endpoint support, automation, and regulated-environment support discipline.",
            styles["Body"],
        )
    )
    story.append(
        bullet(
            [
                "13+ years of enterprise IT engineering and support leadership across Raymond James, RBC Capital Markets, IBM, Ontario Health, City of Toronto, Scotia Bank, and professional-services environments.",
                "Current applied AI work includes multi-agent LLM systems, Claude/OpenAI/Gemini/Azure OpenAI, Model Context Protocol orchestration, prompt engineering, retrieval-oriented knowledge architecture, workflow automation, and browser/tool automation.",
                "Enterprise ITSM experience includes ServiceNow ITSM/ITOM, HP Service Manager, SLA/KPI dashboards, CMDB lifecycle practices, major incident management, change/problem management, runbooks, and analyst coaching.",
                "Microsoft and cloud experience includes Microsoft 365, Entra ID, Intune, Defender, Azure Monitor, Azure AI/OpenAI, Active Directory, Group Policy, conditional access, MFA, hybrid identity, endpoint support, and disaster recovery/business continuity support.",
                "Security/privacy-aware experience includes SOX, OSFI, IIROC, PIPEDA, PHIPA, RSA Archer GRC, audit-ready change evidence, access controls, data privacy safeguards, Microsoft Defender, and exposure-management tooling.",
                "Education and certifications include Seneca College Advanced Diploma in Computer Networking & Technical Support, Project Management Certification, Agile Project Management Certification, ITIL Foundations, Six Sigma Yellow Belt, and multiple Anthropic Academy AI/Claude credentials completed or in progress in 2026.",
            ],
            styles,
        )
    )
    story.append(p("Resource Support Model", styles["H2"]))
    story.append(
        p(
            "IIS can scale delivery through qualified resources for L1/L2/L3 IT support, Microsoft 365/Azure/Intune/Entra support, AI implementation engineering, ServiceNow/ITSM workflow support, technical writing, training materials, project coordination, QA, and privacy/security advisory review. All such resources would operate under IIS delivery controls, role descriptions, client approval where required, confidentiality obligations, onboarding, task/risk/issue tracking, QA review, status reporting, and escalation to Ahmad as senior accountable lead.",
            styles["Body"],
        )
    )

    story.append(p("B.4.4 Demonstrated Experience", styles["H1"]))
    story.append(
        p(
            "The following examples demonstrate capability across the selected IT service functions. Reference contacts are not invented in this draft; IIS will provide authorized reference contact details before final submission or upon Invest Nova Scotia request, subject to client/employer permission and confidentiality requirements.",
            styles["Body"],
        )
    )

    experience = [
        (
            "Integrated IT Support Inc. - ARIA AI Automation and Procurement Intelligence Platform (2023-present)",
            [
                "Purpose/objective: build a production multi-agent system to support procurement intelligence, opportunity filtering, prospect enrichment, knowledge retrieval, operational briefings, tax/expense automation, and business workflow support.",
                "Approach/tools: Anthropic Claude, OpenAI, MCP server orchestration, Python, Node.js, browser automation, Netlify, markdown/YAML knowledge architecture, scheduled agents, tool/function calling, CRM enrichment workflows, and structured prompt/task pipelines.",
                "Outcome: operating platform with 9+ scheduled autonomous agents, 12+ MCP/tool integrations, live website/service presence at iisupp.net, automated procurement research, CRM enrichment, draft generation, and evidence-based opportunity filtering.",
                "Reference contact: Ahmad Wasee, Founder and Senior AI Engineer, Integrated IT Support Inc., ahmad.wasee@iisupp.net, +1 647-581-3182.",
            ],
        ),
        (
            "Raymond James - Regulated ITSM, Endpoint, AI-Ready Knowledge and Automation Support (2020-present, key personnel experience)",
            [
                "Purpose/objective: support a regulated capital-markets technology environment with high-reliability service desk, executive/trader-floor support, incident response, endpoint migration, ITSM workflow, CMDB practices, and AI-ready knowledge documentation.",
                "Approach/tools: ServiceNow ITSM, Microsoft Intune, Entra ID, Microsoft 365, Active Directory, Citrix, Azure, Microsoft Copilot/Azure OpenAI practitioner work, RCA/runbook templates, incident-summary drafting, ticket templates, routing logic, and documentation standards.",
                "Outcome: improved operational consistency through ticket templates, knowledge base/runbook practices, major-incident discipline, Windows 11/Intune migration support, executive/trader-floor support, and reduced resolution friction on common support patterns.",
                "Reference contact: pending Ahmad approval and employer/client permission for release.",
            ],
        ),
        (
            "Small Business AI Enablement and Technical Tutoring Support (2023-present)",
            [
                "Purpose/objective: help small-business users understand practical AI adoption, workflow automation, prompt structure, tool selection, web presence, and support-process improvement without exposing sensitive data or overbuilding technology.",
                "Approach/tools: discovery sessions, workflow mapping, AI usage guardrails, training/tutoring, Microsoft/Google/OpenAI/Anthropic tooling demonstrations, website/content support, and practical documentation for repeatable tasks.",
                "Outcome: increased client/user confidence with AI tools, clearer automation candidates, better knowledge organization, and lower-friction adoption planning for small organizations with limited internal IT capacity.",
                "Reference contact: pending Ahmad approval and client permission for release.",
            ],
        ),
    ]
    for title, items in experience:
        story.append(p(title, styles["H2"]))
        story.append(bullet(items, styles))

    story.append(p("Delivery Controls for Future Statements of Work", styles["H1"]))
    story.append(
        bullet(
            [
                "Confirm mandatory requirements, security/privacy constraints, work location, data sensitivity, and acceptance criteria before accepting a future SOW.",
                "Use a lightweight delivery plan: scope, assumptions, risks, dependencies, task register, status cadence, deliverable QA checklist, and escalation path.",
                "Keep AI use controlled: no sensitive Invest Nova Scotia content is processed through external AI tools unless explicitly authorized in the SOW and aligned with applicable data-handling requirements.",
                "Use subcontractor or partner support only where qualifications, availability, confidentiality, client approval, and supervision model are confirmed.",
                "Provide clear deliverables such as assessment reports, implementation plans, runbooks, knowledge-base articles, automation scripts/workflows, training materials, support guides, and operational dashboards.",
            ],
            styles,
        )
    )

    story.append(p("Compliance and Accuracy Note", styles["H1"]))
    story.append(
        p(
            "This response is intentionally scoped to truthful, supportable IIS capabilities. IIS welcomes future second-stage statements of work in the selected Information Technology Goods & Services functions where the required work aligns with the capabilities described above.",
            styles["Body"],
        )
    )

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    return PROPOSAL_PDF


def fill_appendix(signed: bool = False) -> Path:
    sys.path.insert(0, str((ROOT / ".codex-temp-py").resolve()))
    import fitz

    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(SRC_APPENDIX))
    values = {
        "Full Legal Name of Respondent Organizations legal name": "Integrated IT Support Inc.",
        "Any Other Relevant Name under which Respondent Carries on Business": "Integrated IT Support Inc. / IIS",
        "Street Address": "30 Fothergill Court",
        "City ProvinceState": "Whitby, Ontario",
        "Postal Code  Zip Code": "L1P 1L4",
        "Phone Number": "+1 647-581-3182",
        "Company Website if any": "https://iisupp.net",
        "Respondent Contact Name and Title": "Ahmad Wasee, Founder and Senior AI Engineer",
        "Respondent Contact Phone": "+1 647-581-3182",
        "Respondent Contact Email": "ahmad.wasee@iisupp.net",
        "Check Box8": True,
    }
    if signed:
        values.update(
            {
                "INITIAL BELOW TO CONFIRM ENCLOSUREAppendix A Submission Form": "AW",
                "Name of Respondent Representative": "Ahmad Wasee",
                "Title of Respondent Representative": "Founder and Senior AI Engineer",
                "Name of Organization": "Integrated IT Support Inc.",
                "Date": "June 5, 2026",
            }
        )

    for page in doc:
        for widget in page.widgets() or []:
            if widget.field_name in values:
                value = values[widget.field_name]
                if widget.field_type_string == "Text":
                    widget.text_fontsize = 9.5
                    if widget.field_name == "Respondent Contact Name and Title":
                        widget.text_fontsize = 8.8
                    if widget.field_name == "Full Legal Name of Respondent Organizations legal name":
                        widget.text_fontsize = 10.5
                if isinstance(value, bool):
                    widget.field_value = "Yes" if value else "Off"
                else:
                    widget.field_value = value
                widget.update()

    out = APPENDIX_FINAL_PDF if signed else APPENDIX_PDF
    doc.save(str(out), deflate=True, garbage=4)
    return out


def render_pdf(pdf_path: Path, prefix: str) -> list[Path]:
    sys.path.insert(0, str((ROOT / ".codex-temp-py").resolve()))
    import fitz

    QA_DIR.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    out_paths = []
    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False)
        out = QA_DIR / f"{prefix}-page-{i}.png"
        pix.save(str(out))
        out_paths.append(out)
    return out_paths


def main() -> None:
    proposal = build_proposal()
    appendix = fill_appendix()
    appendix_final = fill_appendix(signed=True)
    proposal_renders = render_pdf(proposal, "proposal")
    appendix_renders = render_pdf(appendix, "appendix-a")
    appendix_final_renders = render_pdf(appendix_final, "appendix-a-final")
    print(f"proposal={proposal}")
    print(f"appendix={appendix}")
    print(f"appendix_final={appendix_final}")
    print(f"proposal_pages={len(proposal_renders)}")
    print(f"appendix_pages={len(appendix_renders)}")
    print(f"appendix_final_pages={len(appendix_final_renders)}")


if __name__ == "__main__":
    main()
