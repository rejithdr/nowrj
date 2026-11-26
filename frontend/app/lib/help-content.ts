/**
 * "How to use" guides, one set per kind of user. Words in “curly quotes”
 * are the exact labels on screen and are shown in bold. Screenshots live in
 * public/help/<shot>.webp and were taken on a phone-sized screen.
 */

export type HelpStep = { text: string; shot?: string; alt?: string };
export type HelpGuide = {
  slug: string;
  title: string;
  summary: string;
  /** Where to go to do this. */
  open?: { label: string; href: string };
  steps: HelpStep[];
  tips?: string[];
};
export type HelpRoleSlug = "listener" | "rj" | "station" | "network" | "business";
export type HelpRole = { slug: HelpRoleSlug; title: string; who: string; guides: HelpGuide[] };

const listener: HelpRole = {
  slug: "listener",
  title: "Listeners",
  who: "Everyone who listens to the radio and uses NowRJ on their phone.",
  guides: [
    {
      slug: "sign-in",
      title: "Sign in and choose your district",
      summary: "You can look around without an account. Sign in to send requests, vote and message the team.",
      open: { label: "Open NowRJ", href: "/" },
      steps: [
        { text: "Tap “Sign in” at the top right and choose your Google account." },
        { text: "The first time, NowRJ asks “Are you 18 or older?”. Tap “Yes, I'm 18 or older”. NowRJ accounts are only for adults; if you are under 18 you can still listen and call the shows without an account.", shot: "listener-age", alt: "The question “Are you 18 or older?” with two buttons" },
        { text: "On the home page, tap “Your district” and pick where you live. You will see the stations you can hear there.", shot: "listener-home", alt: "NowRJ home page with the district picker and Live now" },
        { text: "To change your name or sign out, tap your name at the top right." },
      ],
    },
    {
      slug: "find-shows",
      title: "Find shows, RJs and stations",
      summary: "See what is on air now, what is coming up, and follow your favourite RJs.",
      open: { label: "Live now", href: "/" },
      steps: [
        { text: "The home page has “Live now”, “Coming up” (the next 24 hours), “Recently aired” and “All programmes”." },
        { text: "To look for someone, tap “Search” at the top (or “Find RJs” at the bottom of any page) and type a name. Use “RJs”, “Stations” or “Programmes” to narrow it down.", shot: "listener-search", alt: "The search page" },
        { text: "Open an RJ's page and tap “Follow” to keep up with their shows." },
        { text: "Tap “Call the show” on a show card to dial the studio during the show." },
      ],
    },
    {
      slug: "request",
      title: "Request a song, dedicate or send a message",
      summary: "Send something to the RJ for a show that is live or coming up.",
      open: { label: "Live now", href: "/" },
      steps: [
        { text: "On the show card, tap “Request or dedicate”. On question programmes the button says “Ask a question”.", shot: "listener-showcard", alt: "A show card with Request or dedicate, Like and Fire" },
        { text: "Choose “Song request”, “Dedication” or “Message”, and fill it in." },
        { text: "Under “On air”, choose “OK to read on air” or “Just for the RJ, don't read it out”. If it may be read out, pick the “Name to read out”, or “Don't say my name”.", shot: "listener-request", alt: "The request form with the on-air choice" },
        { text: "Tap “Send to” the programme. You can send a few per show; the form tells you how many are left. The card then shows what happened: “Seen by RJ” or “Seen by the station”, then “Played ✓”, “Read on air ✓” or “Answered on air ✓”." },
      ],
      tips: [
        "Do not put phone numbers, email addresses or links in a message. NowRJ will ask you to take them out.",
        "On health and similar programmes, answers are general information only, not medical advice. In an emergency call 112.",
      ],
    },
    {
      slug: "react",
      title: "Like, Fire and vote in polls",
      summary: "Tell the RJ you are enjoying the show.",
      open: { label: "Live now", href: "/" },
      steps: [
        { text: "Tap “Like” or “Fire” on the show card. You can do this during the show and for 4 hours after it ends." },
        { text: "When the RJ starts a poll, it appears on the show card under “Poll”. Tap your choice to vote; your choice is marked “Your vote”." },
      ],
    },
    {
      slug: "ask-guest",
      title: "Ask a guest a question, or ask to take part",
      summary: "Some shows are recorded with a guest. Send your question before the recording.",
      open: { label: "Ask the guest", href: "/#ask-the-guest" },
      steps: [
        { text: "On the home page, look under “Ask the guest”. Each card shows the guest, the programme and when it will be recorded.", shot: "listener-guest", alt: "A guest card with Ask the guest or RJ" },
        { text: "Tap “Ask the guest or RJ”, choose “Who is your question for?”, write your question and send it. Questions open 24 hours before the recording and close 2 hours before." },
        { text: "Want to be on the recording yourself? Tap “Ask to take part”, give your phone number and a short note. The team calls the people they choose." },
        { text: "After the recording, your question shows “Used in the recording ✓” or “Not used this time”." },
      ],
      tips: ["Only the programme team sees your phone number. It is deleted after 30 days."],
    },
    {
      slug: "take-part",
      title: "Take part in a show, or nominate someone",
      summary: "Some programmes invite listeners on air, like a singing slot or a wrong-number prank call.",
      open: { label: "Live now", href: "/" },
      steps: [
        { text: "If a programme is taking people, its show card or programme page shows the invitation with “Take part” and, if allowed, “Nominate someone”.", shot: "listener-takepart", alt: "The take part box on a programme page" },
        { text: "To take part: enter “Your phone number *” and, if you like, tell the team about you. Send it." },
        { text: "To nominate: enter “Their name *” and “Their phone number *”, and why them. The team always calls the person first and only puts them on air if they agree." },
        { text: "The box then shows where each one is: “Sent”, “The team has been in touch”, “Confirmed ✓” or “Not this time”." },
      ],
      tips: ["Only nominate people who would enjoy it. Phone numbers are seen only by the programme team and deleted after 30 days."],
    },
    {
      slug: "private-message",
      title: "Send a private message to the team",
      summary: "Feedback, an idea or a thank-you that is not for reading on air.",
      open: { label: "My messages", href: "/messages" },
      steps: [
        { text: "Open the programme's page and find “Private message to the team”. Only you and the programme's RJs, station and office see it.", shot: "listener-private", alt: "The private message box on a programme page" },
        { text: "Write “Your message” and send it. It shows “Seen by the team” once they have read it." },
        { text: "When the team replies, an orange dot appears next to your name at the top. Tap your name, then “My messages” to read and reply.", shot: "listener-messages", alt: "The My messages page" },
      ],
    },
    {
      slug: "interested",
      title: "Ask a business about an offer",
      summary: "Tap “I'm interested” on an ad and the business gets in touch.",
      steps: [
        { text: "Open an ad and tap “I'm interested”.", shot: "listener-ad", alt: "An ad page with I'm interested" },
        { text: "Under “How to be contacted”, choose “Share my number” to get a call, or “Message only” to write to them." },
        { text: "The business's replies appear in “My messages”." },
        { text: "Changed your mind? Open the ad again and tap “Stop this enquiry” or “Remove my number and stop”." },
      ],
      tips: ["Your number is removed after 90 days, or straight away when you stop the enquiry."],
    },
    {
      slug: "share",
      title: "Share a show with friends and family",
      summary: "Send a show, an RJ or a station to WhatsApp, Facebook or Instagram.",
      open: { label: "Live now", href: "/" },
      steps: [
        { text: "Tap “Share” on a show card, or on a programme, RJ or station page." },
        { text: "Choose “WhatsApp” or “Facebook”. The link shows a picture card with the show, the RJ and the station." },
        { text: "On a phone, “More… (Instagram and others)” opens your phone's own share list. “Copy link” copies it to paste anywhere." },
        { text: "Friends who open it see what's on and can request a song or call in." },
      ],
    },
    {
      slug: "report",
      title: "Report something wrong",
      summary: "Tell the NowRJ team about wrong, offensive or unsafe content.",
      steps: [
        { text: "Tap “Report” on a show card, or “Report this programme” / “Report this ad” on its page." },
        { text: "Choose “What's wrong?”, add details if you like, and send. The NowRJ team will look at it." },
      ],
    },
    {
      slug: "account",
      title: "Your name, your data and deleting your account",
      summary: "Everything about your account is on one page.",
      open: { label: "Account settings", href: "/account" },
      steps: [
        { text: "Tap your name at the top, then “Account settings”.", shot: "listener-account", alt: "Account settings page" },
        { text: "“Name shown to RJs and stations” is the name that appears with your requests. A first name or nickname is fine. Tap “Save name”." },
        { text: "“Download my data” gives you one file with everything NowRJ keeps about you." },
        { text: "To delete your account, type DELETE in the box and tap “Delete my account”. This cannot be undone." },
      ],
    },
  ],
};

const rj: HelpRole = {
  slug: "rj",
  title: "RJs",
  who: "Radio jockeys who host shows.",
  guides: [
    {
      slug: "get-started",
      title: "Create your RJ profile and get verified",
      summary: "Listeners see you and your programmes once the NowRJ team has verified you.",
      open: { label: "RJ sign-up", href: "/rj/register" },
      steps: [
        { text: "Sign in, tap your name, then “Become an RJ on NowRJ”. If a station sent you an invite link, open it and tap “Create your RJ profile” instead." },
        { text: "Enter “The name listeners know you by” and “Your contact number”, then tap “Submit RJ profile”." },
        { text: "Until you are verified, your profile and programmes stay hidden. To speed it up, use “Get verified faster” on your dashboard: send the link to RJs who know you so they can vouch for you." },
        { text: "If a station invites you, it appears under “Stations you work with”. Tap “Accept” or “Decline”.", shot: "rj-top", alt: "Top of the RJ dashboard" },
      ],
    },
    {
      slug: "station",
      title: "Set your station",
      summary: "Tell NowRJ which station you work at. The station confirms it.",
      open: { label: "RJ dashboard", href: "/rj/dashboard" },
      steps: [
        { text: "On your dashboard, go to “Your station” and choose your station and the “Date you joined”. Use your real joining date, even if it was years ago." },
        { text: "Moved to a new station? Tap “Change station”. Your time at the old one ends the day before the new date." },
        { text: "The station then confirms the dates, or disputes them with a note. You will see “Confirmed by the station” or the note." },
        { text: "Station not listed? Use “Invite your station” and tap “Invite a station” with its name and contact." },
      ],
    },
    {
      slug: "profile",
      title: "Your photo and RJ name",
      summary: "What listeners see on your public page.",
      open: { label: "RJ dashboard", href: "/rj/dashboard" },
      steps: [
        { text: "Under “Your profile”, tap “Change photo” to add a clear photo of yourself." },
        { text: "Change “RJ name” and tap “Save name”." },
        { text: "Tap “View public profile” to see your page as listeners do." },
      ],
    },
    {
      slug: "programmes",
      title: "Add your programmes and times, including repeats",
      summary: "Each programme gets a page, a show card when it is on, and its own messages.",
      open: { label: "Your programmes", href: "/rj/dashboard" },
      steps: [
        { text: "Under “Your programmes”, tap “Add a programme”.", shot: "rj-programmes", alt: "Your programmes with Add a programme" },
        { text: "Enter “Programme name *” and choose where it “Airs on *”." },
        { text: "Add the days and times. For a replay of an earlier broadcast, tick “Repeat of an earlier broadcast”; listeners see it marked “Repeat”." },
        { text: "Add the “Call-in number for the live show” so listeners can tap “Call the show”." },
        { text: "Under “What listeners can send”, choose “Song requests” (songs, dedications and messages) or “Ask a question” for talk and expert shows." },
        { text: "Want listeners on air? Under “Listeners on the show”, tick “Can ask to take part” and/or “Can nominate someone” and write the invitation." },
        { text: "To change it later, tap “Edit programme”." },
      ],
      tips: [
        "If your station claims a programme, it becomes the station's. You will be asked to agree.",
        "Network programmes are set by the network office, so you cannot rename them.",
      ],
    },
    {
      slug: "live-queue",
      title: "Read listener messages during your show",
      summary: "Requests, dedications, messages and questions, show by show.",
      open: { label: "Listener messages", href: "/rj/dashboard" },
      steps: [
        { text: "Open “Listener messages”. Each show is listed with how many messages are waiting. Shows appear from 24 hours before and stay for 2 hours after.", shot: "rj-queue", alt: "Listener messages for a show" },
        { text: "When you play a song or read a message, tap “Played” (on question shows, “Answered”). These buttons open when the show starts." },
        { text: "Not using one? Tap “Skip”. Made a mistake? Tap “Undo”." },
        { text: "A grey “Don't read on air” tag means the listener asked you not to read it out." },
      ],
      tips: ["Listeners see “Seen by RJ” once their message shows here, and the result when you tap a button."],
    },
    {
      slug: "polls",
      title: "Run a poll",
      summary: "Let listeners vote during the show.",
      open: { label: "RJ dashboard", href: "/rj/dashboard" },
      steps: [
        { text: "In “Listener messages”, find the show and tap “Start a poll”." },
        { text: "Type the “Poll question”, for example “Which song should I play next?”, add the choices with “Add an option”, and start it." },
        { text: "Listeners vote on the show card and you see the results as they come in." },
      ],
    },
    {
      slug: "guest-recordings",
      title: "Collect questions for a guest recording",
      summary: "Before you record with a guest, listeners send questions and ask to take part.",
      open: { label: "Ask the guest or RJ", href: "/rj/dashboard" },
      steps: [
        { text: "Under “Ask the guest or RJ”, tap “Add a guest recording”." },
        { text: "Choose the programme, enter “Guest's name *”, “About the guest” and the “Recording date and time *”, and “Airs on (if known)”, then tap “Save guest session”. Then tap “Add photo” for the guest.", shot: "rj-guest", alt: "The guest recording form" },
        { text: "Listeners see it under “Ask the guest” on the home page. Questions close 2 hours before the recording." },
        { text: "When questions close, mark each one “Used in recording” or “Skip”. Listeners see the result." },
        { text: "If the recording is called off, tap “Cancel session”." },
      ],
    },
    {
      slug: "inbox",
      title: "Taking part, nominations and private messages",
      summary: "Call listeners who want to be on air, and reply to private messages.",
      open: { label: "RJ dashboard", href: "/rj/dashboard" },
      steps: [
        { text: "Open “Taking part, nominations and private messages”. Under “Taking part & nominations” you see each person's name and number.", shot: "rj-inbox", alt: "Taking part and private messages" },
        { text: "As you work through them, tap “Contacted”, “Agreed”, “Declined / not picked” or “Done / aired”. “Undo” goes back a step." },
        { text: "For a nomination, call the person who was nominated first. Only mark “Done / aired” after they have “Agreed”." },
        { text: "Under “Private messages”, type in “Reply privately…” and tap “Reply”. The listener sees it in “My messages”." },
      ],
      tips: ["Phone numbers are deleted after 30 days. Do not save them anywhere else."],
    },
    {
      slug: "shout-outs",
      title: "Read a sponsor shout-out",
      summary: "Some ads are shout-outs you read on your show.",
      open: { label: "RJ dashboard", href: "/rj/dashboard" },
      steps: [
        { text: "Approved shout-outs for your shows appear under “Shout-outs for your shows”." },
        { text: "Read it on air, then tap “Put on air” so listeners see it on your show card. The button works once the show starts." },
      ],
    },
    {
      slug: "show-changes",
      title: "Cancel or move one show",
      summary: "For a one-day change. The weekly schedule stays the same.",
      open: { label: "Your programmes", href: "/rj/dashboard" },
      steps: [
        { text: "Under “Your programmes”, tap “Cancel or move a show”. You see the “Next 7 days”." },
        { text: "Pick the show. Cancel it, or set a “New start” and “New end”, then tap “Done”." },
        { text: "To put it back, tap “Cancel change”." },
      ],
    },
    {
      slug: "grow",
      title: "Your referral link and your numbers",
      summary: "Bring listeners and other RJs, and see how your shows are doing.",
      open: { label: "RJ dashboard", href: "/rj/dashboard" },
      steps: [
        { text: "Under “Your referral link”, tap “Copy” or “WhatsApp” and share it on air and on social media. You see “People who joined” and “RJs who joined”." },
        { text: "“Your engagement” shows Followers, Likes, Fires, Call taps, Song requests and Questions, by programme and by show." },
      ],
    },
  ],
};

const station: HelpRole = {
  slug: "station",
  title: "Station staff",
  who: "Programme, RJ and ad staff at a radio station, including stations in a network.",
  guides: [
    {
      slug: "get-started",
      title: "Join your station on NowRJ",
      summary: "Either apply for your station, or open the staff invite your manager sent.",
      open: { label: "For stations", href: "/for-stations" },
      steps: [
        { text: "Got a staff invite link? Open it, tap “Sign in with Google” with the email it was sent to, then “Open the station dashboard”." },
        { text: "No invite? Go to “For stations”, tap “Apply to join”, choose “Our station is new to NowRJ” or “Our station is already listed”, and fill in the station details." },
        { text: "The NowRJ team checks every station and role. Until then you see “Awaiting verification”." },
        { text: "Afterwards, tap your name, then “Station dashboard”.", shot: "station-top", alt: "Top of the station dashboard" },
      ],
    },
    {
      slug: "staff",
      title: "Staff, designations and what each person can do",
      summary: "Give each person only the access their job needs.",
      open: { label: "Staff & designations", href: "/org" },
      steps: [
        { text: "On the station dashboard, tap “Staff & designations”." },
        { text: "Under “Designations”, tap “Add a designation” (for example “Programme producer”). For each area (Programmes, RJs, Ads – Sponsored, Ads – Shout-out, Ads – Aired spots, Stats) choose None, View, Edit or Authorise. Authorise includes Edit, and Edit includes View.", shot: "station-org", alt: "Designations and staff" },
        { text: "Under “Invite staff”, enter their “Email (their Google account)”, the place and the designation, and tap “Create invite”. Send the link by WhatsApp or copy it." },
        { text: "To invite an RJ, use “Invite an RJ” on the same page." },
      ],
    },
    {
      slug: "programmes",
      title: "Programmes, call-in numbers and what listeners can send",
      summary: "Look after the programmes that air on your station.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Scroll to “Programmes on” your station. Programmes an RJ added show “Claim programme”; claim the ones your station owns. The RJ is asked to agree.", shot: "station-programmes", alt: "Programmes on the station" },
        { text: "Tap the button under the programme (it reads “Add call-in number · Song requests · Edit” until a number is set) to set the studio number listeners call." },
        { text: "In the same form, under “What listeners can send”, choose “Song requests” or “Ask a question”." },
        { text: "Under “Listeners on the show”, tick “Can ask to take part” and/or “Can nominate someone”, and write the “Invitation shown to listeners”, for example “Nominate a friend for a wrong-number prank call”." },
      ],
    },
    {
      slug: "districts",
      title: "Choose the districts your station reaches",
      summary: "Listeners who pick those districts see your station.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Find “Districts” your station reaches and tick each district your signal covers." },
        { text: "Tap “Save districts”. Until you choose, listeners in every district see the station." },
      ],
    },
    {
      slug: "live-queue",
      title: "Listener messages during shows",
      summary: "The same list the RJ sees, for every show on your station.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "“Listener messages” lists shows that are live, in the next 24 hours, or ended in the last 2 hours, with how many messages are waiting." },
        { text: "Tap “Played” / “Answered” or “Skip” for each one, and “Undo” if needed. You can also “Start a poll”." },
      ],
    },
    {
      slug: "rjs",
      title: "Confirm your RJs",
      summary: "RJs list your station in their history. Confirm the dates you recognise.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Under “RJs at” your station, rows marked “Needs your review” are waiting." },
        { text: "Tap “Confirm” if the dates are right, or “Dispute” and add a note." },
        { text: "To add or remove RJs, tap “Invite or remove RJs”." },
      ],
    },
    {
      slug: "recordings",
      title: "Recordings and repeats",
      summary: "One recording played in several shows, or on other stations, counted together.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Under “Recordings & repeats”, tap “Add a recording”. Enter the “Title *”, the guest and a description." },
        { text: "Choose the “First airing (premiere)”, then add each later airing. Later airings are shown to listeners as repeats." },
        { text: "To share it, use “Offer to another station…”. That station can add it to its own shows." },
      ],
      tips: ["On repeats, song requests are off; Like, Fire and polls stay on. Ads on each airing belong to that station."],
    },
    {
      slug: "network",
      title: "Carry a network programme",
      summary: "Your regional or head office makes the programme; you choose whether and when it airs here.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Under “Network programmes”, find the programme and tap “Carry on this station”.", shot: "station-network", alt: "Network programmes on a station" },
        { text: "Tap “Add a time” for each live slot and “Add a repeat” for replays, then tap “Carry it”." },
        { text: "To change it, tap “Change times & repeats”. To drop it, tap “Stop carrying”; past shows and messages stay." },
      ],
      tips: ["You can set your studio's call-in number for it, but the name and listener settings come from the network office."],
    },
    {
      slug: "guest-recordings",
      title: "Guest recordings",
      summary: "Collect questions and people who want to take part before a recording.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Under “Ask the guest or RJ”, tap “Add a guest recording”, fill in the guest and the recording time, and tap “Save guest session”. Then tap “Add photo”." },
        { text: "Questions close 2 hours before the recording. Then mark each one “Used in recording” or “Skip”." },
      ],
    },
    {
      slug: "inbox",
      title: "Taking part, nominations and private messages",
      summary: "Work through listeners who want to be on air, and reply privately.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Open “Taking part, nominations & private messages”. Phone numbers are shown to staff who can edit programmes." },
        { text: "Tap “Contacted”, “Agreed”, “Declined / not picked” or “Done / aired”. For nominations, always call the nominated person first and only air them after they have “Agreed”." },
        { text: "Reply to “Private messages” with “Reply”. Your reply is signed with the station's name." },
      ],
      tips: ["Numbers are deleted after 30 days. Do not copy them elsewhere."],
    },
    {
      slug: "advertisers",
      title: "Invite an advertiser and get their consent",
      summary: "A business must be invited and give consent before any of its ads can run.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Under “Advertisers”, tap “Invite an advertiser”. Enter “Business name”, “Contact person”, “Email (their Google account)” and phone, then send them the invite link.", shot: "station-ads", alt: "Advertisers and ads on the station dashboard" },
        { text: "The business accepts the invite and gives consent online. If they prefer paper, tap “Print consent form”, get it signed, then “Upload signed scan”; the NowRJ team checks it." },
        { text: "Open the advertiser to build their “Ad library”: tap “Add a creative” with the offer, “Timings (optional)”, “Address (optional)”, “Phone for the Call button” and “Website (optional)”." },
        { text: "If the advertiser suggests a change, you see “Advertiser suggests:”. Make the change and mark it done." },
      ],
    },
    {
      slug: "ads",
      title: "Enter and approve ads",
      summary: "Every ad is approved by a second person before listeners see it.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "Under “Ads”, tap “Enter an ad”. Choose the “Kind of ad”: Sponsored, RJ shout-out or Aired spot." },
        { text: "Choose the “Advertiser” and the “Creative”, then either “A programme over dates” (with “First day” and “Last day”) or “One show”." },
        { text: "Someone else with Authorise opens it under “Waiting for approval” and taps “Approve” or “Reject” with a reason." },
        { text: "For an RJ shout-out, the RJ or station staff tap “Put on air” during the show. Use “Withdraw” to stop any ad at once." },
      ],
      tips: ["Ads only show if the advertiser's consent is in place. The ad list shows how many listeners tapped “I'm interested”."],
    },
    {
      slug: "numbers",
      title: "Engagement and pilot numbers",
      summary: "See how your shows are doing.",
      open: { label: "Station dashboard", href: "/station/dashboard" },
      steps: [
        { text: "“Listener engagement” shows Likes, Fires, Call taps, Requests and Questions for the last 7 days, by programme and by show." },
        { text: "“Pilot numbers” shows how many phones opened NowRJ, how many did something, and “Where people drop off”. Choose “Last 7 days”, “Last 30 days” or “Last 90 days”." },
      ],
    },
  ],
};

const network: HelpRole = {
  slug: "network",
  title: "Network & regional office",
  who: "Programme staff at a network's head office or a regional office.",
  guides: [
    {
      slug: "get-started",
      title: "Open your network programmes",
      summary: "For staff whose designation includes Programmes.",
      open: { label: "Network programmes", href: "/network" },
      steps: [
        { text: "Your network adds you as staff at the head office or a region. Open the invite link and sign in with that Google account." },
        { text: "Tap your name at the top, then “Network programmes”.", shot: "network-top", alt: "The Network programmes page" },
      ],
    },
    {
      slug: "create",
      title: "Make a network programme",
      summary: "You make the programme; each station sets its own times.",
      open: { label: "Network programmes", href: "/network" },
      steps: [
        { text: "Tap “New network programme”." },
        { text: "Enter the “Programme name”, choose “For the stations of” (the head office or a region) and tick the RJs." },
        { text: "Choose what listeners can send (“Song requests” or “Ask a question”) and whether listeners “Can ask to take part” or “Can nominate someone”, with the invitation text." },
        { text: "Tap “Create programme”. Station programme staff then see it on their dashboard and choose to carry it with their own times and repeats." },
        { text: "Use “Edit” to change it. “Stop everywhere” ends it on every station from today; past shows and messages stay." },
      ],
    },
    {
      slug: "inbox",
      title: "Taking part, nominations and private messages",
      summary: "From listeners of your programmes on every station.",
      open: { label: "Network programmes", href: "/network" },
      steps: [
        { text: "Open “Taking part, nominations & private messages”. You see each person's name and number and the station they came from.", shot: "network-inbox", alt: "Network inbox" },
        { text: "Tap “Contacted”, “Agreed”, “Declined / not picked” or “Done / aired”. For nominations, call the nominated person first." },
        { text: "Reply to private messages with “Reply”. Your reply is signed with your office's name." },
      ],
    },
    {
      slug: "guest-recordings",
      title: "Guest recordings",
      summary: "Set up a guest recording on one station's copy of the programme.",
      open: { label: "Network programmes", href: "/network" },
      steps: [
        { text: "Under “Guest recordings: ask the guest or RJ”, tap “Add a guest recording” and pick the station's programme." },
        { text: "Listeners send questions and ask to take part until 2 hours before the recording. Then mark each question “Used in recording” or “Skip”." },
      ],
    },
    {
      slug: "regions",
      title: "Regions, stations and staff",
      summary: "For staff who can manage staff.",
      open: { label: "Staff & designations", href: "/org" },
      steps: [
        { text: "Tap your name, then “Staff & designations”." },
        { text: "Under “Regions and stations”, add a “New region” or “Add a station”. The NowRJ team checks each new station before listeners can see it." },
        { text: "Staff placed at a region can work on every station under it. Staff at the head office cover the whole network." },
        { text: "Invite staff under “Invite staff” with their email, place and designation." },
      ],
    },
  ],
};

const business: HelpRole = {
  slug: "business",
  title: "Businesses",
  who: "Shops and businesses that advertise through their radio station.",
  guides: [
    {
      slug: "get-started",
      title: "Accept your station's invite and give consent",
      summary: "Your station sends you a link. Your ads can only run after you give consent.",
      steps: [
        { text: "Open the invite link from your station and tap “Sign in with Google” with the email the station used." },
        { text: "Read the consent, enter “Your full name” and tap “Agree and continue”. If you signed a printed form instead, the station uploads it and the NowRJ team checks it." },
        { text: "Tap “Open advertiser dashboard”. Next time, tap your name at the top, then “Advertiser dashboard”.", shot: "business-top", alt: "The advertiser dashboard" },
        { text: "You can “Withdraw consent” at any time. Your ads stop until you give consent again." },
      ],
    },
    {
      slug: "interested",
      title: "Call or reply to interested listeners",
      summary: "People who tapped “I'm interested” on your ads.",
      open: { label: "Advertiser dashboard", href: "/advertiser/dashboard" },
      steps: [
        { text: "Open “Interested listeners”. A number means they want a call; a message means they want a reply.", shot: "business-leads", alt: "Interested listeners" },
        { text: "Call the ones who shared a number. To write back, type in “Reply in NowRJ…” and tap “Reply”. The listener sees it in “My messages”." },
        { text: "Mark each one “Contacted” or “Close”. “Mark new” puts it back." },
        { text: "An orange dot by your name at the top tells you something new has come in." },
      ],
      tips: ["Use numbers only for this enquiry. They are removed after 90 days, or when the listener stops the enquiry."],
    },
    {
      slug: "stats",
      title: "See how your ads are doing",
      summary: "Opens, calls, website taps and interested listeners for each ad.",
      open: { label: "Advertiser dashboard", href: "/advertiser/dashboard" },
      steps: [{ text: "“How your ads are doing” lists each ad with Opened, Calls, Website and Interested." }],
    },
    {
      slug: "library",
      title: "Your ad library and asking for changes",
      summary: "Your station prepares the ads. You can ask for changes.",
      open: { label: "Advertiser dashboard", href: "/advertiser/dashboard" },
      steps: [
        { text: "“Your ad library” shows each ad the station prepared for you." },
        { text: "Tap “Suggest a change”, write “Your suggestion” and tap “Send”. The station makes the change." },
      ],
    },
  ],
};

export const HELP_ROLES: HelpRole[] = [listener, rj, station, network, business];

export function helpRole(slug: string): HelpRole | undefined {
  return HELP_ROLES.find((r) => r.slug === slug);
}

export function helpGuide(role: string, guide: string): { role: HelpRole; guide: HelpGuide } | undefined {
  const r = helpRole(role);
  const g = r?.guides.find((x) => x.slug === guide);
  return r && g ? { role: r, guide: g } : undefined;
}
