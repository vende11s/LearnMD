import { useId } from 'react';
import {
  Folder,
  BookOpen,
  GraduationCap,
  Lightbulb,
  FlaskConical,
  Code2,
  Calculator,
  Globe,
  Leaf,
  Music,
  Palette,
  Briefcase,
  Heart,
  Star,
  Target,
  Bookmark,
  Check,
  type LucideIcon,
} from 'lucide-react';
import {
  FOLDER_ICON_IDS,
  normalizeFolderIcon,
  type FolderIconId,
} from '../folderIcons';
import { useI18n } from '../i18n';
import './folder-icons.css';

const icons: Record<FolderIconId, LucideIcon> = {
  folder: Folder,
  book: BookOpen,
  'graduation-cap': GraduationCap,
  lightbulb: Lightbulb,
  flask: FlaskConical,
  code: Code2,
  calculator: Calculator,
  globe: Globe,
  leaf: Leaf,
  music: Music,
  palette: Palette,
  briefcase: Briefcase,
  heart: Heart,
  star: Star,
  target: Target,
  bookmark: Bookmark,
};
const labels: Record<FolderIconId, readonly [string, string]> = {
  folder: ['Folder', 'Folder'],
  book: ['Book', 'Książka'],
  'graduation-cap': ['Graduation cap', 'Biret'],
  lightbulb: ['Lightbulb', 'Żarówka'],
  flask: ['Flask', 'Kolba'],
  code: ['Code', 'Kod'],
  calculator: ['Calculator', 'Kalkulator'],
  globe: ['Globe', 'Globus'],
  leaf: ['Leaf', 'Liść'],
  music: ['Music', 'Muzyka'],
  palette: ['Palette', 'Paleta'],
  briefcase: ['Briefcase', 'Aktówka'],
  heart: ['Heart', 'Serce'],
  star: ['Star', 'Gwiazda'],
  target: ['Target', 'Cel'],
  bookmark: ['Bookmark', 'Zakładka'],
};

/** A decorative glyph; the accompanying folder name supplies its accessible label. */
export function FolderGlyph({
  icon,
  size = 17,
  strokeWidth = 1.8,
  className,
}: {
  icon?: unknown;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const normalized = normalizeFolderIcon(icon);
  const Icon = icons[normalized];
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      data-folder-icon={normalized}
    />
  );
}

/** Native radios support Tab and arrow keys without a separate custom focus model. */
export function FolderIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value?: FolderIconId;
  onChange: (icon: FolderIconId) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const name = useId();
  const selected = normalizeFolderIcon(value);
  return (
    <fieldset className="folder-icon-picker" disabled={disabled}>
      <legend>{t('Folder icon', 'Ikona folderu')}</legend>
      <div
        className="folder-icon-preview"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="folder-icon-preview-glyph">
          <FolderGlyph icon={selected} size={26} strokeWidth={1.5} />
        </span>
        <div>
          <span>{t('Selected icon', 'Wybrana ikona')}</span>
          <strong>{t(...labels[selected])}</strong>
        </div>
      </div>
      <div className="folder-icon-grid">
        {FOLDER_ICON_IDS.map((icon) => (
          <label
            className="folder-icon-option"
            key={icon}
            title={t(...labels[icon])}
          >
            <input
              type="radio"
              name={name}
              value={icon}
              checked={selected === icon}
              onChange={() => onChange(icon)}
              aria-label={t(...labels[icon])}
            />
            <span className="folder-icon-choice">
              <FolderGlyph icon={icon} size={21} />
              {selected === icon && (
                <Check
                  className="folder-icon-check"
                  size={10}
                  strokeWidth={3}
                  aria-hidden="true"
                />
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
