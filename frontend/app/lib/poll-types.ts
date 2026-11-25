/** A poll as the server sends it (shows/now and the RJ/station queue). */
export type Poll = {
  id: string;
  question: string;
  /** Open until closed, or until the show's Like/Fire window ends. */
  open: boolean;
  total: number;
  createdAt: string;
  options: { id: string; label: string; votes: number }[];
};

export const percent = (votes: number, total: number) => (total ? Math.round((votes / total) * 100) : 0);
