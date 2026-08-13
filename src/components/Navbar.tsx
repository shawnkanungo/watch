export default function Navbar() {
  return (
    <header className="fixed top-0 z-30 w-full bg-gradient-to-b from-black/80 to-transparent px-4 py-4 sm:px-8">
      <div className="flex items-center gap-8">
        <span className="text-2xl font-black tracking-tight text-[#e50914] sm:text-3xl">
          WATCH
        </span>
        <nav className="hidden gap-5 text-sm text-zinc-200 sm:flex">
          <a href="https://shawnkanungo.com" className="font-semibold text-white hover:text-zinc-300">
            Home
          </a>
        </nav>
      </div>
    </header>
  );
}
