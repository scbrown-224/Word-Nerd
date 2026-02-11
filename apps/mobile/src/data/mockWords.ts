export type Topic = {
  id: string;
  name: string;
  seeds: string[];
};

export type Word = {
  id: string;
  word: string;
  definition: string;
  example: string;
  topics: string[];
  audioUrl?: string | null;
  pos?: string;
  phoneticsText?: string;
  createdAt?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
};

export type UserWordProgress = {
  wordId: string;
  status: "learning" | "learned" | "mastered";
  seenCount: number;
  correctCount: number;
  incorrectCount: number;
  isFavorite: boolean;
  srs: {
    nextReviewAt: string;
    intervalDays: number;
    easeFactor: number;
    lastReviewedAt: string;
  };
};

export const topics: Topic[] = [
  { id: "biology", name: "Biology", seeds: ["biology", "cell", "genetics", "enzyme"] },
  { id: "climate", name: "Climate", seeds: ["climate", "carbon", "warming", "feedback"] },
  { id: "mindset", name: "Mindset", seeds: ["resilience", "focus", "growth", "discipline"] },
];

export const words: Word[] = [
  {
    id: "enzyme",
    word: "Enzyme",
    definition: "A protein that accelerates chemical reactions without being consumed.",
    example: "Digestive enzymes help break down food into nutrients.",
    topics: ["biology"],
    audioUrl: null,
    pos: "noun",
    phoneticsText: "/EN-zym/",
    createdAt: new Date().toISOString(),
    difficulty: "intermediate",
  },
  {
    id: "cell",
    word: "Cell",
    definition: "The smallest structural unit of a living organism.",
    example: "Each cell contains genetic material inside its nucleus.",
    topics: ["biology"],
    audioUrl: null,
    pos: "noun",
    phoneticsText: "/sell/",
    createdAt: new Date().toISOString(),
    difficulty: "beginner",
  },
  {
    id: "genetics",
    word: "Genetics",
    definition: "The study of heredity and variation in organisms.",
    example: "Modern genetics was shaped by Mendel's pea plant experiments.",
    topics: ["biology"],
    audioUrl: null,
    pos: "noun",
    phoneticsText: "/juh-NET-iks/",
    createdAt: new Date().toISOString(),
    difficulty: "intermediate",
  },
  {
    id: "feedback",
    word: "Feedback",
    definition: "When an outcome loops back to influence the process that produced it.",
    example: "Melting ice reduces reflection, creating a positive climate feedback.",
    topics: ["climate"],
    audioUrl: null,
    pos: "noun",
    phoneticsText: "/FEED-bak/",
    createdAt: new Date().toISOString(),
    difficulty: "intermediate",
  },
  {
    id: "sequester",
    word: "Sequester",
    definition: "To capture and store a substance, especially carbon, for a long period.",
    example: "Coastal mangroves sequester large amounts of carbon in their soils.",
    topics: ["climate"],
    audioUrl: null,
    pos: "verb",
    phoneticsText: "/si-KWES-ter/",
    createdAt: new Date().toISOString(),
    difficulty: "advanced",
  },
  {
    id: "resilient",
    word: "Resilient",
    definition: "Able to recover quickly from difficulty.",
    example: "A resilient mindset helps teams bounce back after setbacks.",
    topics: ["mindset"],
    audioUrl: null,
    pos: "adjective",
    phoneticsText: "/ri-ZIL-yent/",
    createdAt: new Date().toISOString(),
    difficulty: "beginner",
  },
  {
    id: "discipline",
    word: "Discipline",
    definition: "The practice of training oneself to follow rules or a code of behavior.",
    example: "Daily practice requires discipline more than talent.",
    topics: ["mindset"],
    audioUrl: null,
    pos: "noun",
    phoneticsText: "/DIS-uh-plin/",
    createdAt: new Date().toISOString(),
    difficulty: "intermediate",
  },
];

export const mockUser = {
  id: "mock-user",
  email: "test@example.com",
  selectedTopics: ["biology", "climate"],
  wordsPerDay: 5,
  createdAt: new Date().toISOString(),
};

export const mockUserWords: UserWordProgress[] = [
  {
    wordId: "enzyme",
    status: "learning",
    seenCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    isFavorite: false,
    srs: {
      nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      intervalDays: 1,
      easeFactor: 2.5,
      lastReviewedAt: new Date().toISOString(),
    },
  },
  {
    wordId: "feedback",
    status: "learned",
    seenCount: 4,
    correctCount: 4,
    incorrectCount: 0,
    isFavorite: true,
    srs: {
      nextReviewAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      intervalDays: 2,
      easeFactor: 2.6,
      lastReviewedAt: new Date().toISOString(),
    },
  },
];
