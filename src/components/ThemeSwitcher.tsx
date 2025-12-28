import { useTheme, ThemeType } from '@/contexts/ThemeContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Palette, Crown, Shield, Moon, Sun } from 'lucide-react';

const themeIcons: Record<ThemeType, React.ReactNode> = {
  'dark': <Moon className="h-4 w-4" />,
  'royal-dark': <Crown className="h-4 w-4" />,
  'royal-gold': <Crown className="h-4 w-4 text-yellow-500" />,
  'royal-purple': <Crown className="h-4 w-4 text-purple-500" />,
  'royal-silver': <Crown className="h-4 w-4 text-slate-400" />,
  'government-blue': <Shield className="h-4 w-4 text-blue-600" />,
};

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Palette className="h-4 w-4 text-muted-foreground" />
      <Select value={theme} onValueChange={(value) => setTheme(value as ThemeType)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            <div className="flex items-center gap-2">
              {themeIcons[theme]}
              <span>{themes.find(t => t.value === theme)?.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {themes.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              <div className="flex items-center gap-2">
                {themeIcons[t.value]}
                <div className="flex flex-col">
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
