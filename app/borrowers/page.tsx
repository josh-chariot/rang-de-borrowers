import type { Metadata } from "next";
import { BorrowersPage } from "./BorrowersPage";

export const metadata: Metadata = {
  title: "All borrowers | Rang De",
  description: "Meet the 31,000+ rural businesses that got a loan through Rang De.",
};

export default function Page() {
  return <BorrowersPage />;
}
