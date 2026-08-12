import { PlayerPage } from "@/features/player/player-page";

export default async function PlayerRoutePage({
  params,
}: Readonly<{
  params: Promise<{ bookId: string }>;
}>) {
  const { bookId } = await params;
  return <PlayerPage bookId={bookId} />;
}
