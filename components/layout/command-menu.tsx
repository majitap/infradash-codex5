"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FolderGit2Icon, UserIcon } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { activeProjects, committers } from "@/lib/mock-data"
import { searchNavGroups as navGroups } from "@/lib/nav"
import { TONES } from "@/lib/tones"

type CommandMenuContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const CommandMenuContext = React.createContext<CommandMenuContextValue | null>(null)

export function useCommandMenu() {
  const ctx = React.useContext(CommandMenuContext)
  if (!ctx) throw new Error("useCommandMenu must be used within CommandMenuProvider")
  return ctx
}

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const value = React.useMemo(() => ({ open, setOpen }), [open])

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <CommandMenu />
    </CommandMenuContext.Provider>
  )
}

function CommandMenu() {
  const { open, setOpen } = useCommandMenu()
  const router = useRouter()

  const go = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="빠른 이동" description="페이지, 프로젝트, 사용자를 검색합니다">
      <CommandInput placeholder="페이지, 프로젝트, 사용자 검색..." />
      <CommandList className="max-h-96">
        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
        {navGroups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.url}
                value={item.title}
                keywords={item.keywords}
                onSelect={() => go(item.url)}
              >
                <item.icon className={TONES[item.tone].text} />
                <span>{item.title}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">{item.description}</span>
                <CommandShortcut>{item.url}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="프로젝트">
          {activeProjects.slice(0, 8).map((p) => (
            <CommandItem key={p.id} value={p.path} keywords={[p.language, p.group]} onSelect={() => go("/projects")}>
              <FolderGit2Icon className="text-tone-emerald" />
              <span className="font-medium">{p.name}</span>
              <span className="truncate text-xs text-muted-foreground">{p.group}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="사용자">
          {committers.slice(0, 6).map((u) => (
            <CommandItem key={u.id} value={`${u.name} ${u.username}`} onSelect={() => go("/users")}>
              <UserIcon className="text-tone-indigo" />
              <span className="font-medium">{u.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                @{u.username} · {u.department}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
