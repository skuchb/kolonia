export interface CmsFallbackState {
  npcs: Array<{ id: string; dataJson: string; enabled: number; adminNote?: string | null }>;
  quotes: Array<{
    id: string;
    npcId: string;
    dataJson: string;
    enabled: number;
    qualityStatus: string;
    adminNote?: string | null;
  }>;
  maps: Array<{
    id: string;
    name: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    metersPerPixel: number;
    defaultToleranceMeters: number;
    active: number;
  }>;
  mapPuzzles: Array<{
    id: number;
    mapId: string;
    npcId: string;
    x: number;
    y: number;
    toleranceMeters?: number | null;
    chapterPl?: string | null;
    chapterEn?: string | null;
    chapterDe?: string | null;
    label?: string | null;
  }>;
  dailyPuzzles: Array<{
    puzzle: number;
    mode: string;
    npcId?: string | null;
    quoteId?: string | null;
    mapPuzzleId?: number | null;
    published: number;
  }>;
}

export function cmsSnapshotEmpty(snapshot: CmsFallbackState): boolean {
  return snapshot.npcs.length === 0 && snapshot.quotes.length === 0;
}
