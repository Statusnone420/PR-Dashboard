export const mockSavedIssues = [
  {
    id: 28121,
    number: 28121,
    title: "Fix Hydration mismatch error on generic components",
    repository: {
      name: "react",
      owner: { login: "facebook" },
      full_name: "facebook/react",
      stargazers_count: 220000
    },
    html_url: "https://github.com/facebook/react/issues/28121",
    labels: [
      { name: "bug", color: "ef4444" },
      { name: "high-priority", color: "a78bfa" }
    ],
    comments: 2,
    assignee: null,
    assignees: [],
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    body: "Hydration mismatch error occurs when rendering generic wrapper components on the server vs client. We need to unify the server-rendered elements structure with client hydration checks."
  },
  {
    id: 51025,
    number: 51025,
    title: "App Router: Memory leak when prefetching dynamic routes",
    repository: {
      name: "next.js",
      owner: { login: "vercel" },
      full_name: "vercel/next.js",
      stargazers_count: 120000
    },
    html_url: "https://github.com/vercel/next.js/issues/51025",
    labels: [
      { name: "performance", color: "a78bfa" },
      { name: "app-router", color: "3f3f46" }
    ],
    comments: 4,
    assignee: null,
    assignees: [],
    updated_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10h ago
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    body: "Prefetching dynamic routes leads to mounting dynamic router trees repeatedly without garbage collection. Leads to a steady memory increase during long client sessions."
  },
  {
    id: 11025,
    number: 11025,
    title: "Arbitrary values failing with certain calc() functions",
    repository: {
      name: "tailwindcss",
      owner: { login: "tailwindlabs" },
      full_name: "tailwindlabs/tailwindcss",
      stargazers_count: 78000
    },
    html_url: "https://github.com/tailwindlabs/tailwindcss/issues/11025",
    labels: [
      { name: "bug", color: "ef4444" },
      { name: "compiler", color: "71717a" }
    ],
    comments: 22,
    assignee: { login: "adamwathan" },
    assignees: [{ login: "adamwathan" }],
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1d ago
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    body: "The compiler fails to resolve nested brackets inside CSS custom properties combined with Tailwind custom arbitary calc() values. We should improve bracket matching parser."
  }
];

export const mockActivePRs = [
  {
    id: 1425,
    number: 1425,
    title: "feat: Add support for nested container queries",
    repository: "obsidian/core",
    state: "Open",
    reviews: "2 reviews pending",
    status: "success", // passing
    updated_at: "2h ago"
  },
  {
    id: 992,
    number: 992,
    title: "refactor: migrate data store layer to rust core",
    repository: "obsidian/core",
    state: "Draft",
    reviews: "WIP",
    status: "draft",
    updated_at: "1d ago"
  },
  {
    id: 104,
    number: 104,
    title: "fix: memory leak in websocket reconnection logic",
    repository: "obsidian/core",
    state: "Changes Requested",
    reviews: "Review requested",
    status: "error", // red
    updated_at: "3d ago"
  }
];

export const mockSearchIssues = [
  {
    id: 142,
    number: 142,
    title: "Implement concurrent rendering mode for complex views",
    repository: {
      name: "core",
      owner: { login: "obsidian" },
      full_name: "obsidian/core",
      stargazers_count: 12400
    },
    html_url: "https://github.com/obsidian/core/issues/142",
    labels: [
      { name: "help wanted", color: "a78bfa" },
      { name: "enhancement", color: "34d399" }
    ],
    comments: 4,
    assignee: null,
    assignees: [],
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    body: "The current rendering pipeline blocks the main thread during heavy computations. We need to implement a segmented rendering approach to maintain 60fps during intense view updates. This is highly aligned with our rendering refactoring project."
  },
  {
    id: 4521,
    number: 4521,
    title: "Hydration mismatch on dynamic SVG imports",
    repository: {
      name: "next.js",
      owner: { login: "vercel" },
      full_name: "vercel/next.js",
      stargazers_count: 120000
    },
    html_url: "https://github.com/vercel/next.js/issues/4521",
    labels: [
      { name: "good first issue", color: "34d399" },
      { name: "area: routing", color: "27272a" }
    ],
    comments: 5,
    assignee: null,
    assignees: [],
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    body: "Dynamic SVG imports loaded within layouts produce mismatched DOM nodes. The server generates standard tags, but dynamic hydration injects placeholder wrappers causing runtime mismatch warnings."
  },
  {
    id: 8912,
    number: 8912,
    title: "net/http: improve error message on malformed headers",
    repository: {
      name: "go",
      owner: { login: "golang" },
      full_name: "golang/go",
      stargazers_count: 115000
    },
    html_url: "https://github.com/golang/go/issues/8912",
    labels: [
      { name: "help wanted", color: "a78bfa" }
    ],
    comments: 12,
    assignee: { login: "rsc" },
    assignees: [{ login: "rsc" }],
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1d ago
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    body: "When headers are malformed, we throw a generic 400 Bad Request without disclosing which header was problematic. We should provide structured error responses for developer-friendly tracing."
  },
  {
    id: 1102,
    number: 1102,
    title: "Add utility classes for container query ranges",
    repository: {
      name: "tailwindcss",
      owner: { login: "tailwindlabs" },
      full_name: "tailwindlabs/tailwindcss",
      stargazers_count: 78000
    },
    html_url: "https://github.com/tailwindlabs/tailwindcss/issues/1102",
    labels: [
      { name: "feature", color: "34d399" }
    ],
    comments: 89,
    assignee: null,
    assignees: [],
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    body: "We need classes to support queries like @min-w-[200px] and @max-w-[400px] natively to make compound queries extremely elegant. Let's add them as part of the container query plugin core."
  },
  {
    id: 24110,
    number: 24110,
    title: "Warning: Cannot update a component while rendering a different component",
    repository: {
      name: "react",
      owner: { login: "facebook" },
      full_name: "facebook/react",
      stargazers_count: 220000
    },
    html_url: "https://github.com/facebook/react/issues/24110",
    labels: [
      { name: "bug", color: "ef4444" }
    ],
    comments: 210,
    assignee: null,
    assignees: [],
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    body: "State updates triggered inside child component render functions lead to strict mode errors. We need to document these scenarios and throw specific compile-time or developer warning pointers."
  }
];

export const mockBoardCards = {
  "Considering": [
    {
      id: 4812,
      number: 4812,
      title: "Add support for container query units in arbitrary values",
      repository: {
        name: "tailwindcss",
        owner: { login: "tailwindlabs" },
        full_name: "tailwindlabs/tailwindcss",
        stargazers_count: 78000
      },
      html_url: "https://github.com/tailwindlabs/tailwindcss/issues/4812",
      labels: [
        { name: "enhancement", color: "34d399" }
      ],
      comments: 3,
      assignee: null,
      assignees: [],
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Tailwind doesn't parse container query CSS units like cqw/cqh correctly within arbitary custom layouts e.g. w-[20cqw]. Adding native tokens to the theme parser resolves it."
    },
    {
      id: 24901,
      number: 24901,
      title: "Investigate hydration mismatch on server-rendered SVGs",
      repository: {
        name: "react",
        owner: { login: "facebook" },
        full_name: "facebook/react",
        stargazers_count: 220000
      },
      html_url: "https://github.com/facebook/react/issues/24901",
      labels: [
        { name: "bug", color: "ef4444" }
      ],
      comments: 8,
      assignee: null,
      assignees: [],
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      body: "SVGs styled with inline CSS on the server produce standard tags, but dynamic hydration injects wrapper styles resulting in mismatches."
    }
  ],
  "Read Docs": [
    {
      id: 51022,
      number: 51022,
      title: "App Router dynamic segment caching behavior documentation is unclear",
      repository: {
        name: "next.js",
        owner: { login: "vercel" },
        full_name: "vercel/next.js",
        stargazers_count: 120000
      },
      html_url: "https://github.com/vercel/next.js/issues/51022",
      labels: [
        { name: "docs", color: "27272a" }
      ],
      comments: 1,
      assignee: null,
      assignees: [],
      updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12h ago
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      body: "The current reference documentation does not clarify that dynamic router segments are fully opt-out from standard cache-control headers on static builds. We should structure a dynamic segment caching matrix."
    }
  ],
  "Asked Maintainer": [
    {
      id: 8291,
      number: 8291,
      title: "Proposal: New macro for reactivity destructuring",
      repository: {
        name: "core",
        owner: { login: "vuejs" },
        full_name: "vuejs/core",
        stargazers_count: 45000
      },
      html_url: "https://github.com/vuejs/core/issues/8291",
      labels: [
        { name: "Awaiting Reply", color: "71717a" }
      ],
      comments: 14,
      assignee: null,
      assignees: [],
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1d ago
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Reactivity destructuring leads to reactive property loss. A new compile-time macro would compile destructured arguments into native vue computed getter references automatically."
    }
  ],
  "Working": [
    {
      id: 12044,
      number: 12044,
      title: "Optimize dependency pre-bundling cache invalidation logic",
      repository: {
        name: "vite",
        owner: { login: "vitejs" },
        full_name: "vitejs/vite",
        stargazers_count: 64000
      },
      html_url: "https://github.com/vitejs/vite/issues/12044",
      labels: [
        { name: "terminal", color: "a78bfa" }
      ],
      comments: 6,
      assignee: { login: "yyx990803" },
      assignees: [{ login: "yyx990803" }],
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      body: "We currently reload all pre-bundled modules whenever lockfile or config shifts. We can speed this up by checking module sub-dependencies and invalidating cached items on a fine-grained, localized level.",
      progress: 65,
      commits: 3,
      checklist: [
        { text: "Identify stale cache scenarios", completed: true },
        { text: "Implement targeted invalidation", completed: false },
        { text: "Write integration tests", completed: false }
      ]
    }
  ],
  "PR Open": [
    {
      id: 6102,
      number: 6102,
      title: "Fix layout shift during fast client-side navigation",
      repository: {
        name: "remix",
        owner: { login: "remix-run" },
        full_name: "remix-run/remix",
        stargazers_count: 26000
      },
      html_url: "https://github.com/remix-run/remix/pull/6102",
      labels: [
        { name: "needs-review", color: "71717a" }
      ],
      comments: 7,
      assignee: null,
      assignees: [],
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Rapid page loads block component transition states, causing severe DOM layout shifts during mountings. Adding transition delays and memoizing layout elements resolves it.",
      pr: true,
      checks_passing: true
    }
  ],
  "Merged": [
    {
      id: 99991,
      number: 99991,
      title: "Improve compiler error messages for missing exports",
      repository: {
        name: "svelte",
        owner: { login: "sveltejs" },
        full_name: "sveltejs/svelte",
        stargazers_count: 74000
      },
      html_url: "https://github.com/sveltejs/svelte/issues/99991",
      labels: [],
      comments: 15,
      assignee: { login: "rich-harris" },
      assignees: [{ login: "rich-harris" }],
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      body: "The compiler throws vague index-based warnings when dynamic export matching fails. Rewrote mapping indexer to print detailed file names and line positions.",
      merged_by: "rich-harris"
    }
  ],
  "Passed": [
    {
      id: 88881,
      number: 88881,
      title: "Implement missing crypto.subtle algorithms",
      repository: {
        name: "deno",
        owner: { login: "denoland" },
        full_name: "denoland/deno",
        stargazers_count: 91000
      },
      html_url: "https://github.com/denoland/deno/issues/88881",
      labels: [],
      comments: 45,
      assignee: null,
      assignees: [],
      updated_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Proposed standard subtle cryptographical routines. Decided not to pursue as it was moved into external Deno WASM cryptography packages.",
      status_passed: "Decided not to pursue"
    }
  ]
};
