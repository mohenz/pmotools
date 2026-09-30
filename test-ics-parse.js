const ical = require("node-ical");
const fs = require("fs");

const text = fs.readFileSync("test/TEST 일정.ics", "utf8");
const events = ical.sync.parseICS(text);

const parsedEvents = [];
for (const k in events) {
  if (events.hasOwnProperty(k)) {
    const ev = events[k];
    if (ev.type === "VEVENT") {
      const attendees = [];
      const missingAttendees = [];

      let atts = [];
      if (ev.attendee) {
        atts = Array.isArray(ev.attendee) ? ev.attendee : [ev.attendee];
      }
      if (ev.organizer) {
        atts.push(ev.organizer);
      }

      for (const att of atts) {
        let email = "";
        let name = "";
        if (typeof att === 'string') {
          email = att;
        } else {
          email = att.val;
          if (att.params && att.params.CN) name = att.params.CN;
        }
        const emailMatches = email.match(/mailto:(.*)/i);
        if (emailMatches) email = emailMatches[1];
        if (!name) name = email;

        missingAttendees.push(`${name} (${email})`);
      }

      let note = "";
      if (missingAttendees.length > 0) {
        note = `[미등록 참석자]\n${missingAttendees.join("\n")}`;
      }

      parsedEvents.push({
        tempId: k,
        title: ev.summary || "제목 없음",
        startAt: ev.start ? new Date(ev.start).toISOString() : new Date().toISOString(),
        endAt: ev.end ? new Date(ev.end).toISOString() : (ev.start ? new Date(ev.start).toISOString() : new Date().toISOString()),
        description: ev.description || "",
        location: ev.location || "",
        attendees,
        note,
        rawOrganizer: ev.organizer
      });
    }
  }
}

console.log(JSON.stringify(parsedEvents, null, 2));
