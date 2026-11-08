import al from "./locales/al";
import en from "./locales/en";

export const translations = { al, en };
export type Language = keyof typeof translations;
