# COMPUTER CLEANUP PROTOCOL — NovaVerse
## Owner: Ingrid K Santana
## Run by: @ADMIN_ASSISTANT
## Safety Rule: NOTHING DELETED without Ingrid approval

---

## PHASE 1: SAFETY BACKUP (Do This First)

Create backup folder:

---

## PHASE 2: DESKTOP PURGE

1. Create folder: `~/Desktop/INBOX_SORT/`
2. Move ALL files from Desktop into INBOX_SORT
3. Desktop should be completely empty except:
   - Trash bin
   - Computer/Home icon
   - Any hard drives

---

## PHASE 3: DOWNLOADS ARCHIVE

1. Create folder: `~/Downloads/_ARCHIVE_2026/`
2. Move everything older than 7 days into _ARCHIVE_2026
3. Keep in Downloads only:
   - Files downloaded today or this week
   - Active project files you're currently using
~/NovaVerse/
├── 01_ACTIVE/
│   ├── Grants/
│   ├── Content/
│   ├── Tannie/
│   ├── Finance/
│   └── Projects/
├── 02_TEMPLATES/
│   ├── Grant_Templates/
│   ├── Content_Templates/
│   └── Email_Templates/
├── 03_ARCHIVE/
│   ├── 2026_Completed/
│   └── Old_Desktop_Files/
├── 04_REFERENCE/
│   ├── Brand_Guidelines/
│   ├── About_Me_Docs/
│   └── Research/
└── BACKUPS/
    └── (dated backup folders)

---

## PHASE 5: SORTING INBOX_SORT

For each file in INBOX_SORT, suggest destination:

| File Pattern | Suggested Folder | Ingrid Decision |
|-------------|------------------|-----------------|
| "grant", "proposal", "funding" | 01_ACTIVE/Grants/ | [ ] Move [ ] Keep |
| "Tannie", "content", "reel", "video" | 01_ACTIVE/Content/ | [ ] Move [ ] Keep |
| "budget", "invoice", "receipt" | 01_ACTIVE/Finance/ | [ ] Move [ ] Keep |
| "template", "example" | 02_TEMPLATES/ | [ ] Move [ ] Keep |
| Screenshot, random image | 03_ARCHIVE/ or DELETE | [ ] Move [ ] Keep [ ] Trash |
| Old, completed project | 03_ARCHIVE/2026_Completed/ | [ ] Move [ ] Keep |

**Rule:** Show Ingrid the list. Get approval before moving. No exceptions.

---

## PHASE 6: NAMING CONVENTION

All files going forward:

Examples:
- `2026-05-06_TANNIE_WEEK4_SCHEDULE_v1.xlsx`
- `2026-05-06_GRANT_NSF_DRAFT_v2.docx`
- `2026-05-06_CONTENT_REEL_SCRIPT_v1.md`

---

## PHASE 7: MASTER INDEX

Create and maintain:

Format:
```markdown
# NovaVerse File Index
Last updated: 2026-05-06

## Active Projects
| File | Location | Status | Owner Role |
|------|----------|--------|------------|
| Tannie Week 4 Schedule | 01_ACTIVE/Content/ | In Progress | @PROJECT_MANAGER |
| NSF Grant Draft | 01_ACTIVE/Grants/ | Drafting | @GRANT_WRITER |

## Quick Find
- "Tannie" → 01_ACTIVE/Content/
- "Grant" → 01_ACTIVE/Grants/
- "Budget" → 01_ACTIVE/Finance/
- "Old" → 03_ARCHIVE/
WEEKLY MAINTENANCE (Every Friday)
Check Desktop — should be empty
Check Downloads — archive anything >7 days old
Update _INDEX.md
Confirm all active files are in 01_ACTIVE/
EMERGENCY: "I Can't Find Something!"
Check ~/NovaVerse/BACKUPS/ first
Check ~/Desktop/INBOX_SORT/ (if cleanup not finished)
Search by date: "I know I worked on it Tuesday" → check 2026-05-*
Ask @ADMIN_ASSISTANT: "Find file with [keyword]"
PROTECTED ITEMS (Never Move Without Permission)
GitHub repos (stay in GitHub cloud)
Claude conversations (stay in Claude cloud)
Supabase projects (stay in Supabase)
SamCart/Stripe/Resend accounts (cloud services)
Browser bookmarks/passwords
Any file currently open in a program


---

## PHASE 4: FOLDER STRUCTURE (Create These Now)
