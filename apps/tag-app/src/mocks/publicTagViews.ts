import type { PublicTagView } from "../features/vault/types";

const placeholderImage = (label: string, color: string): string =>
  `https://placehold.co/1200x720/${color}/ffffff?text=${encodeURIComponent(label)}`;

export const publicTagViews: Record<string, PublicTagView> = {
  stagv001: {
    tag: {
      id: "stagv001",
      displayName: "Staging Vault – Gast- und Ownerzugang",
      presentation: "public-page",
    },
    vault: {
      blocks: [
        {
          type: "hero",
          title: "Staging-Test-Vault",
          subtitle: "Öffentliche Ansicht für die TAG-Weiterleitung",
          imageUrl: placeholderImage("myQR24 Test Vault", "1f513d"),
        },
        {
          type: "callout",
          tone: "info",
          title: "Öffentliche Ansicht geladen",
          text: "Diese Seite dient ausschließlich dem Staging-Test der Weiterleitung vom Edge Router zur TAG-App.",
        },
        {
          type: "text",
          title: "Testumfang",
          paragraphs: [
            "Das TAG ist eine nicht produktive Fixture ohne personenbezogene Inhalte.",
            "Private Inhalte, Zugangsprüfungen und Uploads werden erst über die künftige serverseitige Vault-API freigeschaltet.",
          ],
        },
      ],
    },
    enabledFeatures: ["vault"],
  },
  rsq45q: {
    tag: {
      id: "rsq45q",
      displayName: "myQR24 Staging-Testtag",
      presentation: "standard",
    },
    vault: {
      blocks: [
        {
          type: "hero",
          title: "Staging-Testtag",
          subtitle: "Die TAG-Weiterleitung zum öffentlichen Vault funktioniert.",
          imageUrl: placeholderImage("myQR24 Staging", "1f513d"),
        },
        {
          type: "callout",
          tone: "info",
          title: "Scan erfolgreich",
          text: "Diese öffentliche Ansicht bestätigt die Weiterleitung vom Staging Edge Router auf die Staging-PWA.",
        },
        {
          type: "text",
          title: "Testumfang",
          paragraphs: [
            "Dieser Inhalt ist eine lokale, öffentliche Fixture der Test-PWA.",
            "Private Daten, Owner-Verwaltung und zukünftige API-Inhalte sind nicht Bestandteil dieses Staging-Tests.",
          ],
        },
      ],
    },
    enabledFeatures: ["vault"],
  },
  koffer24: {
    tag: {
      id: "koffer24",
      displayName: "Reisekoffer",
      presentation: "standard",
    },
    vault: {
      blocks: [
        {
          type: "hero",
          title: "Reisekoffer",
          subtitle: "Öffentliche Informationen zu diesem myQR24 TAG",
          imageUrl: placeholderImage("Reisekoffer", "265047"),
        },
        {
          type: "text",
          title: "Hinweis für Finderinnen und Finder",
          paragraphs: [
            "Dieser Koffer gehört zu einer privaten Reiseausrüstung.",
            "Wenn Sie ihn gefunden haben, verwenden Sie bitte die Funktion „Fund melden“, sobald sie für dieses TAG aktiviert ist.",
          ],
        },
        {
          type: "callout",
          tone: "info",
          title: "Öffentliche Ansicht",
          text: "Private Inhalte, Kontaktdaten und Owner-Verwaltung werden in dieser Ansicht nie angezeigt.",
        },
      ],
    },
    enabledFeatures: ["vault", "lost-found"],
  },
  album042: {
    tag: {
      id: "album042",
      displayName: "Sommer am See",
      presentation: "gallery",
    },
    vault: {
      blocks: [
        {
          type: "hero",
          title: "Sommer am See",
          subtitle: "Eine öffentliche Bildergalerie",
          imageUrl: placeholderImage("Sommer am See", "276749"),
        },
        {
          type: "gallery",
          title: "Ausgewählte Eindrücke",
          images: [
            {
              url: placeholderImage("Morgenlicht", "3f7d67"),
              alt: "Sonnenaufgang an einem See",
              caption: "Morgenlicht",
            },
            {
              url: placeholderImage("Uferweg", "557a46"),
              alt: "Weg am bewachsenen Seeufer",
              caption: "Uferweg",
            },
            {
              url: placeholderImage("Abendstimmung", "8d5b3a"),
              alt: "Abendliche Stimmung über dem Wasser",
              caption: "Abendstimmung",
            },
          ],
        },
        {
          type: "text",
          paragraphs: [
            "Diese Bilder wurden bewusst als öffentliche Inhalte für alle Scannerinnen und Scanner veröffentlicht.",
          ],
        },
      ],
    },
    enabledFeatures: ["vault"],
  },
  trauung1: {
    tag: {
      id: "trauung1",
      displayName: "Lea & Jonas – Hochzeit",
      presentation: "wedding",
    },
    vault: {
      guestContributionDemo: {
        enabled: true,
        label: "Erinnerungen teilen",
        description:
          "Nach der Freischaltung kannst du in dieser Staging-Demo eigene Erinnerungsbilder hinzufügen und nur deine eigenen Demo-Beiträge entfernen.",
        maxImages: 5,
        ownershipRule:
          "Die spätere Vault-API ordnet Beiträge ausschließlich einer serverseitigen Gast-Session zu.",
      },
      blocks: [
        {
          type: "hero",
          title: "Lea & Jonas",
          subtitle: "Wir feiern unsere Hochzeit · 14. Juni 2026",
          imageUrl: placeholderImage("Lea + Jonas", "6b3d52"),
        },
        {
          type: "text",
          title: "Schön, dass du da bist",
          paragraphs: [
            "Danke, dass ihr diesen besonderen Tag mit uns verbringt. Haltet eure liebsten Momente in unserer gemeinsamen Galerie fest.",
            "Dokumente zur Feier findet ihr im Bereich „Dokumente“.",
          ],
        },
        {
          type: "gallery",
          title: "Erste Momente",
          images: [
            {
              id: "welcome",
              url: placeholderImage("Willkommen", "8c5a61"),
              alt: "Florale Tischdekoration bei einer Hochzeit",
              caption: "Willkommen zur Feier",
              downloadable: true,
            },
            {
              id: "ceremony",
              url: placeholderImage("Trauung", "456b62"),
              alt: "Symbolisches Hochzeitsmotiv vor grüner Kulisse",
              caption: "Nach der Trauung",
              downloadable: true,
            },
            {
              id: "celebration",
              url: placeholderImage("Gemeinsam feiern", "b27d4e"),
              alt: "Festlich gedeckter Tisch",
              caption: "Auf einen wunderschönen Abend",
              downloadable: true,
            },
          ],
        },
        {
          type: "documents",
          title: "Dokumente zur Feier",
          description: "Alle Dokumente sind als öffentliche Demo-Platzhalter hinterlegt.",
          documents: [
            {
              id: "menu",
              kind: "menu",
              title: "Speisekarte",
              description: "Aperitif, Dinner und Mitternachtssnack",
              url: "https://placehold.co/1200x1697/f8f1e7/3e2f25?text=Speisekarte",
              availableLabel: "Jetzt verfügbar",
            },
            {
              id: "invitation",
              kind: "invitation",
              title: "Einladung",
              description: "Details zur Trauung und Feier",
              url: "https://placehold.co/1200x1697/efe2d3/3e2f25?text=Einladung",
              availableLabel: "Jetzt verfügbar",
            },
            {
              id: "thanks",
              kind: "thank-you",
              title: "Dankeschön",
              description: "Wird nach der Hochzeit veröffentlicht.",
              url: "https://placehold.co/1200x1697/e9efe7/304839?text=Dankesch%C3%B6n",
              availableLabel: "Folgt nach der Feier",
            },
          ],
        },
      ],
    },
    enabledFeatures: ["vault"],
  },
  fest2026: {
    tag: {
      id: "fest2026",
      displayName: "Hochzeitsfeier – nur ansehen",
      presentation: "wedding",
    },
    vault: {
      guestContributionDemo: {
        enabled: false,
        label: "Galerie nur ansehen",
        description:
          "Für diese Konfiguration sind keine Gastbeiträge vorgesehen.",
        maxImages: 0,
        ownershipRule:
          "Keine Gastbeiträge aktiviert.",
      },
      blocks: [
        {
          type: "hero",
          title: "Hochzeitsfeier",
          subtitle: "Eine geschlossene Galerie ohne Gastuploads",
          imageUrl: placeholderImage("Hochzeitsfeier", "3f6254"),
        },
        {
          type: "callout",
          tone: "notice",
          title: "Galerie nur ansehen",
          text: "Die Gastgeber haben für dieses TAG keine Gastuploads freigegeben.",
        },
        {
          type: "gallery",
          title: "Freigegebene Erinnerungen",
          images: [
            {
              id: "published",
              url: placeholderImage("Freigegebenes Bild", "648c78"),
              alt: "Öffentlich freigegebenes Erinnerungsbild",
              downloadable: true,
            },
          ],
        },
      ],
    },
    enabledFeatures: ["vault"],
  },
  menue202: {
    tag: {
      id: "menue202",
      displayName: "Hochzeit – Dokumente",
      presentation: "wedding",
    },
    vault: {
      blocks: [
        {
          type: "hero",
          title: "Informationen zur Feier",
          subtitle: "Einladung, Speisekarte und spätere Erinnerungen",
          imageUrl: placeholderImage("Hochzeitsdokumente", "7a5b45"),
        },
        {
          type: "documents",
          title: "Dokumente",
          documents: [
            {
              id: "menu",
              kind: "menu",
              title: "Speisekarte",
              url: "https://placehold.co/1200x1697/f8f1e7/3e2f25?text=Speisekarte",
              availableLabel: "Jetzt verfügbar",
            },
            {
              id: "invitation",
              kind: "invitation",
              title: "Einladung zur Hochzeit",
              url: "https://placehold.co/1200x1697/efe2d3/3e2f25?text=Einladung",
              availableLabel: "Jetzt verfügbar",
            },
          ],
        },
      ],
    },
    enabledFeatures: ["vault"],
  },
  gipfel99: {
    tag: {
      id: "gipfel99",
      displayName: "Sonnspitze",
      presentation: "summit-guide",
    },
    vault: {
      blocks: [
        {
          type: "hero",
          title: "Sonnspitze",
          subtitle: "Öffentliche Informationen zum Aussichtspunkt",
          imageUrl: placeholderImage("Sonnspitze", "205072"),
        },
        {
          type: "callout",
          tone: "safety",
          title: "Sicherheitshinweis",
          text: "Wetter und Wege können sich kurzfristig ändern. Diese Seite ersetzt keine lokale Beschilderung, amtliche Warnungen oder eine Notfallplanung.",
        },
        {
          type: "text",
          title: "Über diesen Ort",
          paragraphs: [
            "Die Sonnspitze ist ein öffentlicher Aussichtspunkt mit Blick ins Tal.",
            "Bitte respektieren Sie Natur, lokale Regeln und die Hinweise vor Ort.",
          ],
        },
        {
          type: "gallery",
          title: "Eindrücke vom Ort",
          images: [
            {
              url: placeholderImage("Panorama", "2e6d5a"),
              alt: "Panoramablick von einem Gipfel",
              caption: "Panorama",
            },
            {
              url: placeholderImage("Wanderweg", "597841"),
              alt: "Markierter Wanderweg",
              caption: "Wanderweg",
            },
          ],
        },
        {
          type: "external-link",
          label: "Weitere Informationen öffnen",
          url: "https://www.example.org/",
          description: "Externer Link zum verantwortlichen Informationsangebot.",
        },
      ],
    },
    enabledFeatures: ["vault", "guestbook", "check-in"],
  },
};
