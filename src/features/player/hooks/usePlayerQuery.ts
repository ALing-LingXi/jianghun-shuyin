"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { playerSchema, type PlayerDto } from "@/shared/schemas/player";

export class PlayerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "PlayerApiError";
  }
}

export async function fetchPlayer(bookId: string): Promise<PlayerDto> {
  const response = await fetch(`/api/player/books/${bookId}`);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new PlayerApiError(
      body?.error?.message ?? "Player request failed",
      response.status,
      body?.error?.code,
    );
  }

  return playerSchema.parse(body);
}

export function usePlayerQuery(bookId: string) {
  return useQuery<PlayerDto, PlayerApiError>({
    queryKey: ["player", bookId],
    queryFn: () => fetchPlayer(bookId),
    refetchInterval: (query) =>
      query.state.data?.parts.some((part) =>
        ["pending", "processing", "tts", "assembling"].includes(part.status),
      )
        ? 3000
        : false,
    refetchIntervalInBackground: true,
    retry: false,
  });
}

export async function retryPart(partId: string): Promise<void> {
  const response = await fetch(`/api/parts/${partId}/retry`, {
    method: "POST",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new PlayerApiError(
      body?.error?.message ?? "Part retry failed",
      response.status,
      body?.error?.code,
    );
  }
}

export function useRetryPart(bookId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, PlayerApiError, string>({
    mutationFn: retryPart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["player", bookId] });
    },
  });
}
