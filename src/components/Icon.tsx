type IconName =
  | "home" | "tasks" | "inventory" | "babies" | "finance" | "settings" | "logout" | "menu"
  | "calendar" | "warning" | "user" | "clock" | "package" | "wallet" | "medical"
  | "alert" | "link" | "bottle" | "baby" | "moon" | "clipboard" | "check" | "x"
  | "plus" | "trash" | "edit" | "search" | "copy" | "chevron-left" | "chevron-right"
  | "filter" | "drag" | "star" | "palette" | "send" | "diaper" | "pill" | "chart"
  | "hand-wave" | "upload" | "bar-chart" | "repeat" | "users" | "trending-up"
  | "pie-chart" | "refresh" | "tag" | "chevron-down" | "chevron-up" | "credit-card"
  | "download" | "layers" | "minus" | "external-link" | "eye" | "grid" | "lock";

export default function Icon({
  name,
  className = "w-4 h-4",
  title,
}: {
  name: IconName;
  className?: string;
  title?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...(title ? { "aria-label": title } : { "aria-hidden": true }),
  };

  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
        </svg>
      );

    case "tasks":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M8 7h11" />
          <path d="M8 12h11" />
          <path d="M8 17h11" />
          <path d="m3.5 7 1.5 1.5L7 6.5" />
          <path d="m3.5 12 1.5 1.5L7 11.5" />
          <path d="m3.5 17 1.5 1.5L7 16.5" />
        </svg>
      );

    case "inventory":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" />
          <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
          <path d="M12 12v9" />
        </svg>
      );

    case "babies":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );

    case "finance":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M4 7h16" />
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M15.5 12h2.5" />
        </svg>
      );

    case "settings":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0A1.7 1.7 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" />
        </svg>
      );

    case "menu":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      );

    case "logout":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );

    case "calendar":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 10h18" />
        </svg>
      );

    case "warning":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M12 3 2.5 20h19L12 3Z" />
          <path d="M12 9v5" />
          <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
        </svg>
      );

    case "user":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );

    case "clock":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </svg>
      );

    case "package":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M16.5 9.4 7.5 4.2" />
          <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.3 7 12 12l8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );

    case "wallet":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
        </svg>
      );

    case "medical":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M12 10v6" />
          <path d="M9 13h6" />
        </svg>
      );

    case "alert":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          <path d="M12 2v1" />
        </svg>
      );

    case "link":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
        </svg>
      );

    case "bottle":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M10 2h4" />
          <path d="M11 2v3h2V2" />
          <rect x="8" y="5" width="8" height="3" rx="1" />
          <path d="M8 8v1a2 2 0 0 0-2 2v8a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-8a2 2 0 0 0-2-2V8" />
          <path d="M6 15h12" />
        </svg>
      );

    case "baby":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="12" cy="10" r="5" />
          <path d="M12 5C12 3 14 2 14 2" />
          <path d="M9.5 9a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1" fill="currentColor" stroke="none" />
          <path d="M14.5 9a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1" fill="currentColor" stroke="none" />
          <path d="M10 12.5c.8.5 1.5.7 2 .7s1.2-.2 2-.7" />
          <path d="M7.5 15c-2 1.5-3 3-3 4.5C4.5 21 6 22 12 22s7.5-1 7.5-2.5c0-1.5-1-3-3-4.5" />
        </svg>
      );

    case "moon":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      );

    case "clipboard":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M12 11h4" />
          <path d="M12 16h4" />
          <path d="M8 11h.01" />
          <path d="M8 16h.01" />
        </svg>
      );

    case "check":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );

    case "x":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      );

    case "plus":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "trash":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );

    case "edit":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      );

    case "search":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );

    case "copy":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );

    case "chevron-left":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );

    case "chevron-right":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      );

    case "filter":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M22 3H2l8 9.5V20l4 2v-8.5L22 3z" />
        </svg>
      );

    case "drag":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    case "star":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1z" />
        </svg>
      );

    case "palette":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="6.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <path d="M12 2a10 10 0 0 0 0 20c1 0 2-.8 2-2a2 2 0 0 1 2-2h1.5A3.5 3.5 0 0 0 21 14.5 10 10 0 0 0 12 2z" />
        </svg>
      );

    case "send":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22 11 13 2 9l20-7z" />
        </svg>
      );

    case "diaper":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M4 6h16v4c0 4-3 8-8 8s-8-4-8-8V6z" />
          <path d="M4 6c0-1.5 2-3 8-3s8 1.5 8 3" />
          <path d="M9 12h6" />
        </svg>
      );

    case "pill":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="m10.5 20.5 10-10a4.95 4.95 0 0 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" />
          <path d="M8.5 8.5 15.5 15.5" />
        </svg>
      );

    case "chart":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-6 4 3 5-7" />
        </svg>
      );

    case "hand-wave":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
          <path d="M7.5 4.5c.7-.7 1.8-.7 2.5 0l6 6" />
          <path d="M10 2c.7-.7 1.8-.7 2.5 0L18 7.5" />
          <path d="M6 6c-.7-.7-.7-1.8 0-2.5" />
          <path d="M4.5 9.5 3 11a7 7 0 0 0 10 10l5.5-5.5" />
          <path d="M16 8l3 3" />
          <path d="M7.5 4.5l9 9" />
        </svg>
      );

    case "upload":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>);
    case "download":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
    case "bar-chart":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><rect x="3" y="9" width="4" height="12"/><rect x="9" y="5" width="4" height="16"/><rect x="15" y="2" width="4" height="19"/></svg>);
    case "repeat":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>);
    case "users":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
    case "trending-up":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>);
    case "pie-chart":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>);
    case "refresh":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.6-5.4L23 4"/></svg>);
    case "tag":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>);
    case "chevron-down":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M6 9l6 6 6-6"/></svg>);
    case "chevron-up":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M18 15l-6-6-6 6"/></svg>);
    case "credit-card":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>);
    case "layers":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>);
    case "minus":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><line x1="5" y1="12" x2="19" y2="12"/></svg>);
    case "external-link":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>);
    case "eye":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
    case "grid":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>);
    case "lock":
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
    default:
      return (<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}><circle cx="12" cy="12" r="8"/></svg>);
  }
}
