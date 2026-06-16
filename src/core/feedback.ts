import type { FeedbackCell, Npc } from "./types";

const CLASSIC_COLUMNS = ["guild", "guildFamily", "location", "isTeacher", "isFriend"] as const;

export function classicFeedback(guess: Npc, target: Npc): FeedbackCell[] {
  return [
    compareExact(guess.guild, target.guild),
    compareExact(guess.guildFamily, target.guildFamily),
    compareLocation(guess, target),
    compareExact(guess.isTeacher, target.isTeacher),
    compareExact(guess.isFriend, target.isFriend),
  ];
}

export function quoteFeedback(guess: Npc, target: Npc): FeedbackCell[] {
  return [
    compareExact(guess.guild, target.guild),
    compareExact(guess.guildFamily, target.guildFamily),
    compareLocation(guess, target),
    compareExact(guess.isTeacher, target.isTeacher),
    compareExact(guess.isFriend, target.isFriend),
  ];
}

export function feedbackToEmoji(cell: FeedbackCell): string {
  switch (cell) {
    case "good":
      return "🟩";
    case "near":
      return "🟨";
    case "bad":
      return "🟥";
    case "up":
      return "⬆️";
    case "down":
      return "⬇️";
  }
}

export function feedbackToPip(cell: FeedbackCell): "hit" | "near" | "miss" {
  if (cell === "good") return "hit";
  if (cell === "near" || cell === "up" || cell === "down") return "near";
  return "miss";
}

export function classicColumnKeys() {
  return CLASSIC_COLUMNS;
}

function compareExact<T>(guess: T, target: T): FeedbackCell {
  return guess === target ? "good" : "bad";
}

function compareLocation(guess: Npc, target: Npc): FeedbackCell {
  if (guess.location === target.location) return "good";
  if (guess.locationArea && guess.locationArea === target.locationArea) return "near";
  return "bad";
}

