// Asset modules imported via the `@/assets/...` path alias. Vite handles the
// actual bundling (each import becomes a URL string); these declarations let
// `tsc` type them instead of failing with TS2307 on the path-mapped file.
declare module '*.webp' {
  const url: string
  export default url
}
declare module '*.woff2' {
  const url: string
  export default url
}
declare module '*.mp3' {
  const url: string
  export default url
}
declare module '*.png' {
  const url: string
  export default url
}
