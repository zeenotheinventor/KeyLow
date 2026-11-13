import {
  isDuplicatePalatePreference,
  useAddPalatePreference,
  usePalatePreferences,
  useRemovePalatePreference,
} from "@keylow/api-client";
import { findAvoidedFood, listAvoidedFoods } from "@keylow/core";
import {
  FOODS_TO_AVOID,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
  describeAvoidedKindConflict,
} from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvoidedFoodRow } from "./AvoidedFoodRow";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  GroupedList,
  Icon,
  Input,
  SegmentedControl,
  SheetHeader,
  Skeleton,
  Text,
  useToast,
} from "../ui";

import type { TextInput } from "react-native";

type AvoidKind = "dislike" | "allergy";

const kindOptions = [
  { value: "dislike", label: FOODS_TO_AVOID.dislike },
  { value: "allergy", label: FOODS_TO_AVOID.allergy },
] as const;

const saveFailedToast = {
  message: SAVE_FAILED_BANNER,
  tone: "danger",
  icon: "CircleAlert",
} as const;

const removeFailedToast = {
  message: FOODS_TO_AVOID.removeFailed,
  tone: "danger",
  icon: "CircleAlert",
} as const;

/**
 * Foods to avoid, pushed from the Assistant settings (`settings · foods-to-avoid`): a line on what the list
 * does, an add card (the field, Dislike or Allergy, Add), the list with each food's kind and a Remove button,
 * and the allergy disclaimer. The kind is chosen when a food is added: to change it, remove the food and add
 * it again. A food already on the list is refused at the field, saying so for the same kind and which kind it is stored as for the other, and any other failed write
 * is a toast. Until the list is read only the header and a loading status are drawn, and a failed first read
 * is an error state with Try again, since no board draws either.
 */
export function FoodsToAvoidScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const preferences = usePalatePreferences();
  const add = useAddPalatePreference();
  // Told here, not in each press, so every failed removal is reported and not only the latest.
  const remove = useRemovePalatePreference({
    onError: () => {
      toast.show(removeFailedToast);
    },
  });
  const fieldRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<AvoidKind>("dislike");
  // What is said at the field about a word that is already on the list, or null.
  const [refusal, setRefusal] = useState<string | null>(null);

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Assistant settings instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/assistant");
    }
  }

  function addFood() {
    if (add.isPending) {
      return;
    }
    // The board draws Add ready with the field empty, so pressing it then asks for the word.
    if (text.trim() === "") {
      fieldRef.current?.focus();
      return;
    }
    // A word on the list under either kind is refused. To change its kind, remove it and add it again.
    const existing =
      preferences.data === undefined ? undefined : findAvoidedFood(preferences.data, text);
    if (existing !== undefined) {
      setRefusal(
        existing.kind === kind
          ? FOODS_TO_AVOID.duplicate
          : describeAvoidedKindConflict(existing.label, existing.kind),
      );
      return;
    }
    add.mutate(
      { kind, label: text },
      {
        onSuccess: () => {
          setText("");
          setRefusal(null);
        },
        onError: (error) => {
          if (isDuplicatePalatePreference(error)) {
            setRefusal(FOODS_TO_AVOID.duplicate);
          } else {
            toast.show(saveFailedToast);
          }
        },
      },
    );
  }

  function renderBody() {
    // A refresh that failed behind a list already read leaves the list as it is.
    if (preferences.isError && preferences.data === undefined) {
      return (
        <ErrorState
          body={FOODS_TO_AVOID.loadFailedBody}
          retry={{
            label: RETRY_LABEL,
            onPress: () => {
              void preferences.refetch();
            },
          }}
          title={FOODS_TO_AVOID.loadFailedTitle}
        />
      );
    }
    if (preferences.data === undefined) {
      return (
        <View
          accessible
          aria-label={FOODS_TO_AVOID.title}
          aria-live="polite"
          className="px-4"
          role="status"
        >
          <Skeleton variant="group" />
        </View>
      );
    }
    const foods = listAvoidedFoods(preferences.data);
    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-6 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-1">
          <Text tone="secondary">{FOODS_TO_AVOID.intro}</Text>
        </View>
        <Card padding={3}>
          <View className="gap-3">
            <Input
              autoCapitalize="none"
              error={refusal ?? undefined}
              fill="well"
              inputRef={fieldRef}
              label={FOODS_TO_AVOID.fieldLabel}
              labelHidden
              maxLength={100}
              placeholder={FOODS_TO_AVOID.placeholder}
              returnKeyType="done"
              value={text}
              onChangeText={(next) => {
                setText(next);
                setRefusal(null);
              }}
              onSubmitEditing={addFood}
            />
            <SegmentedControl
              label={FOODS_TO_AVOID.kindLabel}
              options={kindOptions}
              value={kind}
              onChange={(next) => {
                setKind(next);
                setRefusal(null);
              }}
            />
            <Button disabled={add.isPending} fullWidth variant="secondary" onPress={addFood}>
              {FOODS_TO_AVOID.add}
            </Button>
          </View>
        </Card>
        {foods.length === 0 ? (
          <EmptyState
            body={FOODS_TO_AVOID.emptyBody}
            title={FOODS_TO_AVOID.emptyTitle}
            variant="card"
          />
        ) : (
          <GroupedList title={FOODS_TO_AVOID.listTitle}>
            {foods.map((food, index) => (
              <AvoidedFoodRow
                key={food.preferenceId}
                hasDivider={index > 0}
                kind={food.kind}
                label={food.label}
                onRemove={() => {
                  remove.mutate(food.preferenceId);
                }}
              />
            ))}
          </GroupedList>
        )}
        <Card level="raised" padding={3}>
          <View className="flex-row gap-2">
            <View className="pt-[2px]">
              <Icon name="ShieldAlert" size={16} tone="warning-ink" />
            </View>
            <Text className="flex-1" tone="secondary" variant="caption">
              {FOODS_TO_AVOID.disclaimer}
            </Text>
          </View>
        </Card>
      </ScrollView>
    );
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: FOODS_TO_AVOID.back, onPress: goBack }}
        title={FOODS_TO_AVOID.title}
      />
      {renderBody()}
    </View>
  );
}
