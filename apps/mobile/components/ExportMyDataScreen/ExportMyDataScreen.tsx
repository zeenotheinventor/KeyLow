import { ACCOUNT_EXPORT_COPY, describeExportReady, describeExportSaved } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Banner, Button, Card, ListRow, SheetHeader, Text } from "../ui";
import { useAccountExport } from "./useAccountExport";

/**
 * The Export my data screen, pushed from More (`export · exporting`, `done`, `failed`): what the file holds and
 * the warning that it is health data stay in every state. Under them is the progress row while the file is
 * prepared, the file row once it is ready or saved, or the danger banner when the export failed. The buttons
 * and the caption under them follow the state. Saving has no board, so it is the ready screen with Save file
 * busy and Done held back.
 */
export function ExportMyDataScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, fileName, sizeText, folderName, save, retry } = useAccountExport();
  const copy = ACCOUNT_EXPORT_COPY;

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function renderCaption(text: string) {
    return (
      <Text className="text-center" tone="muted" variant="caption">
        {text}
      </Text>
    );
  }

  function renderStatus() {
    switch (state.status) {
      case "idle":
      case "preparing":
        return (
          <View aria-live="polite" role="status">
            <Card padding={0}>
              <ListRow
                icon="LoaderCircle"
                subtitle={copy.preparing.caption}
                title={copy.preparing.title}
              />
            </Card>
          </View>
        );
      case "ready":
      case "saving":
      case "saved":
        return (
          <View role="status">
            <Card padding={0}>
              <ListRow
                icon="FileJson"
                subtitle={
                  state.status === "saved"
                    ? describeExportSaved(sizeText ?? "", folderName ?? "")
                    : describeExportReady(sizeText ?? "")
                }
                title={fileName ?? ""}
                trailing={{
                  kind: "tick",
                  label: state.status === "saved" ? copy.saved.tickLabel : copy.ready.tickLabel,
                }}
              />
            </Card>
          </View>
        );
      case "failed":
        return <Banner body={copy.failed.body} title={copy.failed.title} variant="error" />;
    }
  }

  function renderFooter() {
    switch (state.status) {
      case "idle":
      case "preparing":
        return (
          <>
            <Button disabled fullWidth>
              {copy.preparing.save}
            </Button>
            {renderCaption(copy.preparing.footer)}
          </>
        );
      case "ready":
      case "saving":
        return (
          <>
            <Button
              fullWidth
              loading={state.status === "saving"}
              onPress={() => {
                void save();
              }}
            >
              {copy.ready.save}
            </Button>
            <Button
              disabled={state.status === "saving"}
              fullWidth
              variant="secondary"
              onPress={goBack}
            >
              {copy.ready.done}
            </Button>
            {renderCaption(copy.ready.footer)}
          </>
        );
      case "saved":
        return (
          <>
            <Button fullWidth onPress={goBack}>
              {copy.saved.done}
            </Button>
            {renderCaption(copy.saved.footer)}
          </>
        );
      case "failed":
        return (
          <Button fullWidth onPress={retry}>
            {copy.failed.retry}
          </Button>
        );
    }
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: copy.back, onPress: goBack }}
        title={copy.title}
        variant="stack"
      />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
        <Card>
          <View className="gap-2">
            <Text role="heading" variant="body-strong">
              {copy.contents.title}
            </Text>
            <Text tone="secondary">{copy.contents.body}</Text>
          </View>
        </Card>
        <Banner icon="ShieldAlert" sentence title={copy.healthData} variant="review" />
        {renderStatus()}
      </ScrollView>
      <View className="gap-2 px-4 pb-3 pt-3">{renderFooter()}</View>
    </View>
  );
}
