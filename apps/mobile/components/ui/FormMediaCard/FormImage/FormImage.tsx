import { EXERCISE_FORM } from "@keylow/core/copy";
import { useState } from "react";
import { Image, View } from "react-native";

import { Icon } from "../../Icon";

import type { FormImageProps } from "./types";

/**
 * A picture of the card, cropped to its size with cover. When it does not load, the placeholder tile takes
 * its place at the same size, so the card does not change height.
 */
export function FormImage({ url, label, sizeClassName, children }: FormImageProps) {
  // The address that failed, so a new address gets its own try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === url) {
    return (
      <View
        accessible
        aria-label={EXERCISE_FORM.imageFailedName}
        className={`items-center justify-center border border-border bg-surface-raised ${sizeClassName}`}
        role="img"
      >
        <Icon name="CameraOff" tone="muted" />
      </View>
    );
  }

  return (
    <View>
      <Image
        accessible
        aria-label={label}
        className={sizeClassName}
        resizeMode="cover"
        role="img"
        source={{ uri: url }}
        onError={() => {
          setFailedUrl(url);
        }}
      />
      {children}
    </View>
  );
}
