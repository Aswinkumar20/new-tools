/** Build a sample calendar anchored near `around` so demos always show events. */
export function buildIcsSampleCalendar(around: Date = new Date()): string {
  const y = around.getUTCFullYear();
  const m = String(around.getUTCMonth() + 1).padStart(2, '0');
  const day = (offset: number): string => {
    const d = new Date(
      Date.UTC(around.getUTCFullYear(), around.getUTCMonth(), around.getUTCDate() + offset)
    );
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${d.getUTCFullYear()}${mm}${dd}`;
  };
  const stamp = `${y}${m}01T120000Z`;
  const d0 = day(0);
  const d1 = day(1);
  const d2 = day(2);
  const d3 = day(3);
  const d4 = day(4);
  const d7 = day(7);
  const d10 = day(10);

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EasyToolHub//ICS Viewer//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Product Roadmap
X-WR-TIMEZONE:UTC
BEGIN:VEVENT
UID:kickoff-demo@easytoolhub.com
DTSTAMP:${stamp}
DTSTART:${d1}T150000Z
DTEND:${d1}T163000Z
SUMMARY:Sprint kickoff
DESCRIPTION:Review goals\\nAlign on milestones for the quarter.
LOCATION:Conference Room A
STATUS:CONFIRMED
CATEGORIES:Meetings,Planning
ORGANIZER;CN=Alex Rivera:mailto:alex@example.com
ATTENDEE;CN=Jordan Lee;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:jordan@example.com
ATTENDEE;CN=Sam Patel;ROLE=OPT-PARTICIPANT;PARTSTAT=TENTATIVE;RSVP=TRUE:mailto:sam@example.com
URL:https://example.com/sprint-kickoff
PRIORITY:5
SEQUENCE:1
CREATED:${stamp}
LAST-MODIFIED:${stamp}
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:offsite-demo@easytoolhub.com
DTSTAMP:${stamp}
DTSTART;VALUE=DATE:${d2}
DTEND;VALUE=DATE:${d4}
SUMMARY:Design offsite
DESCRIPTION:Multi-day all-day workshop.
LOCATION:Austin HQ
STATUS:CONFIRMED
CATEGORIES:Offsite
ORGANIZER;CN=Alex Rivera:mailto:alex@example.com
CLASS:PUBLIC
END:VEVENT
BEGIN:VEVENT
UID:standup-demo@easytoolhub.com
DTSTAMP:${stamp}
DTSTART:${d0}T140000Z
DTEND:${d0}T141500Z
SUMMARY:Daily standup
DESCRIPTION:15-minute sync for the core team.
LOCATION:Zoom
STATUS:CONFIRMED
CATEGORIES:Meetings,Recurring
RRULE:FREQ=DAILY;COUNT=10
EXDATE:${d3}T140000Z
ORGANIZER;CN=Alex Rivera:mailto:alex@example.com
END:VEVENT
BEGIN:VEVENT
UID:release-demo@easytoolhub.com
DTSTAMP:${stamp}
DTSTART:${d7}T160000Z
DTEND:${d7}T180000Z
SUMMARY:Release freeze window
DESCRIPTION:No deploys during this window.
LOCATION:Remote
STATUS:TENTATIVE
CATEGORIES:Release
PRIORITY:1
END:VEVENT
BEGIN:VEVENT
UID:holiday-demo@easytoolhub.com
DTSTAMP:${stamp}
DTSTART;VALUE=DATE:${d10}
DTEND;VALUE=DATE:${day(11)}
SUMMARY:Company holiday
DESCRIPTION:Office closed.
STATUS:CONFIRMED
CATEGORIES:Holiday
CLASS:PUBLIC
END:VEVENT
BEGIN:VEVENT
UID:overlap-a-demo@easytoolhub.com
DTSTAMP:${stamp}
DTSTART:${d1}T154500Z
DTEND:${d1}T170000Z
SUMMARY:Customer interview
LOCATION:Meet
STATUS:CONFIRMED
CATEGORIES:Research
END:VEVENT
BEGIN:VEVENT
UID:overlap-b-demo@easytoolhub.com
DTSTAMP:${stamp}
DTSTART:${d1}T160000Z
DTEND:${d1}T171500Z
SUMMARY:Partner sync
LOCATION:Meet
STATUS:CONFIRMED
CATEGORIES:Meetings
END:VEVENT
END:VCALENDAR
`.replace(/\n/g, '\r\n');
}

/** Static sample used by unit tests (fixed March 2024 dates). */
export const ICS_SAMPLE_CALENDAR = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//EasyToolHub//ICS Viewer//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Product Roadmap
X-WR-TIMEZONE:UTC
BEGIN:VEVENT
UID:kickoff-2024@easytoolhub.com
DTSTAMP:20240102T120000Z
DTSTART:20240311T150000Z
DTEND:20240311T163000Z
SUMMARY:Sprint kickoff
DESCRIPTION:Review goals\\nAlign on milestones for the quarter.
LOCATION:Conference Room A
STATUS:CONFIRMED
CATEGORIES:Meetings,Planning
ORGANIZER;CN=Alex Rivera:mailto:alex@example.com
ATTENDEE;CN=Jordan Lee;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:jordan@example.com
ATTENDEE;CN=Sam Patel;ROLE=OPT-PARTICIPANT;PARTSTAT=TENTATIVE;RSVP=TRUE:mailto:sam@example.com
URL:https://example.com/sprint-kickoff
PRIORITY:5
SEQUENCE:1
CREATED:20240102T090000Z
LAST-MODIFIED:20240301T150000Z
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:offsite-2024@easytoolhub.com
DTSTAMP:20240110T120000Z
DTSTART;VALUE=DATE:20240314
DTEND;VALUE=DATE:20240317
SUMMARY:Design offsite
DESCRIPTION:Multi-day all-day workshop across Thursday–Saturday.
LOCATION:Austin HQ
STATUS:CONFIRMED
CATEGORIES:Offsite
ORGANIZER;CN=Alex Rivera:mailto:alex@example.com
CLASS:PUBLIC
END:VEVENT
BEGIN:VEVENT
UID:standup-2024@easytoolhub.com
DTSTAMP:20240105T120000Z
DTSTART:20240304T140000Z
DTEND:20240304T141500Z
SUMMARY:Daily standup
DESCRIPTION:15-minute sync for the core team.
LOCATION:Zoom
STATUS:CONFIRMED
CATEGORIES:Meetings,Recurring
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=20
EXDATE:20240315T140000Z
ORGANIZER;CN=Alex Rivera:mailto:alex@example.com
END:VEVENT
BEGIN:VEVENT
UID:release-2024@easytoolhub.com
DTSTAMP:20240201T120000Z
DTSTART:20240320T160000Z
DTEND:20240320T180000Z
SUMMARY:Release freeze window
DESCRIPTION:No deploys during this window.\\nContact on-call if urgent.
LOCATION:Remote
STATUS:TENTATIVE
CATEGORIES:Release
PRIORITY:1
END:VEVENT
BEGIN:VEVENT
UID:holiday-2024@easytoolhub.com
DTSTAMP:20240101T120000Z
DTSTART;VALUE=DATE:20240329
DTEND;VALUE=DATE:20240330
SUMMARY:Company holiday
DESCRIPTION:Office closed.
STATUS:CONFIRMED
CATEGORIES:Holiday
CLASS:PUBLIC
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
UID:overlap-a@easytoolhub.com
DTSTAMP:20240301T120000Z
DTSTART:20240312T150000Z
DTEND:20240312T163000Z
SUMMARY:Customer interview
LOCATION:Meet
STATUS:CONFIRMED
CATEGORIES:Research
END:VEVENT
BEGIN:VEVENT
UID:overlap-b@easytoolhub.com
DTSTAMP:20240301T120000Z
DTSTART:20240312T154500Z
DTEND:20240312T170000Z
SUMMARY:Partner sync
LOCATION:Meet
STATUS:CONFIRMED
CATEGORIES:Meetings
END:VEVENT
END:VCALENDAR
`.replace(/\n/g, '\r\n');
