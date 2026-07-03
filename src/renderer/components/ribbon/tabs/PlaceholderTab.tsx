import {
  File,
  FileText,
  Hash,
  History,
  Image,
  Languages,
  Link,
  MessageSquare,
  Printer,
  Search,
  SeparatorHorizontal,
  Settings,
  Shapes,
  Sigma,
  SpellCheck,
  Square,
  Table,
  Type,
  type LucideIcon
} from 'lucide-react'
import RibbonGroup from '../RibbonGroup'
import RibbonButton from '../RibbonButton'

interface PlaceholderGroup {
  title: string
  items: { icon: LucideIcon; label: string }[]
}

export const PLACEHOLDER_TABS: Record<string, PlaceholderGroup[]> = {
  insert: [
    {
      title: 'Pages',
      items: [
        { icon: FileText, label: 'Cover Page' },
        { icon: File, label: 'Blank Page' },
        { icon: SeparatorHorizontal, label: 'Page Break' }
      ]
    },
    { title: 'Tables', items: [{ icon: Table, label: 'Table' }] },
    {
      title: 'Illustrations',
      items: [
        { icon: Image, label: 'Pictures' },
        { icon: Shapes, label: 'Shapes' }
      ]
    },
    { title: 'Links', items: [{ icon: Link, label: 'Link' }] },
    {
      title: 'Header & Footer',
      items: [{ icon: Hash, label: 'Page Number' }]
    },
    {
      title: 'Symbols',
      items: [
        { icon: Sigma, label: 'Equation' },
        { icon: Type, label: 'Text Box' }
      ]
    }
  ],
  layout: [
    {
      title: 'Page Setup',
      items: [
        { icon: Settings, label: 'Margins' },
        { icon: Square, label: 'Orientation' },
        { icon: FileText, label: 'Size' },
        { icon: SeparatorHorizontal, label: 'Breaks' }
      ]
    },
    { title: 'Print', items: [{ icon: Printer, label: 'Print Setup' }] }
  ],
  review: [
    {
      title: 'Proofing',
      items: [
        { icon: SpellCheck, label: 'Spelling' },
        { icon: Hash, label: 'Word Count' }
      ]
    },
    { title: 'Comments', items: [{ icon: MessageSquare, label: 'New Comment' }] },
    { title: 'Tracking', items: [{ icon: History, label: 'Track Changes' }] },
    {
      title: 'Find',
      items: [
        { icon: Search, label: 'Find' },
        { icon: Languages, label: 'Language' }
      ]
    }
  ]
}

export default function PlaceholderTab({ groups }: { groups: PlaceholderGroup[] }) {
  return (
    <div className="flex h-full items-stretch">
      {groups.map((group) => (
        <RibbonGroup key={group.title} title={group.title}>
          {group.items.map((item) => (
            <RibbonButton
              key={item.label}
              icon={item.icon}
              label={item.label}
              variant="large"
              disabled
              title={`${item.label} - available in a later phase`}
            />
          ))}
        </RibbonGroup>
      ))}
      <div className="flex items-center px-4 text-[12px] italic text-gray-400">
        These commands arrive in a later phase.
      </div>
    </div>
  )
}
