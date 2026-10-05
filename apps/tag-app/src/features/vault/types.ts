export type VaultPresentation =
  | "standard"
  | "gallery"
  | "public-page"
  | "museum-exhibit"
  | "summit-guide"
  | "wedding";

export type PublicDocumentKind = "menu" | "invitation" | "thank-you" | "other";

export interface PublicVaultImage {
  id?: string;
  alt: string;
  caption?: string;
  url: string;
  downloadable?: boolean;
}

export interface PublicVaultDocument {
  id: string;
  title: string;
  kind: PublicDocumentKind;
  description?: string;
  url: string;
  availableLabel?: string;
}

export type VaultBlock =
  | {
      type: "hero";
      title: string;
      subtitle?: string;
      imageUrl?: string;
    }
  | {
      type: "text";
      title?: string;
      paragraphs: string[];
    }
  | {
      type: "callout";
      tone: "info" | "notice" | "safety";
      title: string;
      text: string;
    }
  | {
      type: "gallery";
      title: string;
      images: PublicVaultImage[];
    }
  | {
      type: "documents";
      title: string;
      description?: string;
      documents: PublicVaultDocument[];
    }
  | {
      type: "external-link";
      label: string;
      url: string;
      description?: string;
    };

export interface GuestContributionDemo {
  enabled: boolean;
  label: string;
  description: string;
  maxImages: number;
  ownershipRule: string;
}

export interface PublicTagView {
  tag: {
    id: string;
    displayName: string;
    presentation: VaultPresentation;
  };
  vault: {
    blocks: VaultBlock[];
    guestContributionDemo?: GuestContributionDemo;
  };
  enabledFeatures: Array<"vault" | "lost-found" | "guestbook" | "check-in">;
}
