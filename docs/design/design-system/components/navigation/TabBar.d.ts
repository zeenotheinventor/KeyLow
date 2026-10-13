/**
 * Five-tab bar (Diary, Foods, Recipes, Weight, Settings) in iOS and Android idioms
 * @startingPoint section="Navigation" subtitle="Five-tab bar (Diary, Foods, Recipes, Weight, Settings) in iOS and Android idioms" viewport="360x60"
 */
export interface TabBarProps {
  active?: 'diary' | 'foods' | 'recipes' | 'weight' | 'settings' | string;
  onChange?: (key: string) => void;
  platform?: 'ios' | 'android';
  tabs?: Array<{ key: string; label: string; icon: string }>;
  style?: React.CSSProperties;
}

export declare function TabBar(props: TabBarProps): JSX.Element;
