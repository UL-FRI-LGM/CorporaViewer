// speaker from /meetings/:id/getSpeakers
export interface MeetingSpeaker {
  id: string,
  names: { sl: string, de: string },
  count: number
}
