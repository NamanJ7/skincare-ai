/**
 * Add or edit a shelf product (modal) — name, category, and its actives.
 * `?id=` opens an existing product for editing (e.g. "Tag ingredients" from an
 * unrated shelf row). "I don't know the ingredients" is a first-class answer:
 * it keeps the product honestly unrated instead of forcing ingredient literacy.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ACTIVES, type ActiveKey, type ThemeColors } from "@pore/shared";
import type { UserProduct } from "@/lib/profile";
import { track } from "@/lib/analytics";
import {
  MAX_PRODUCT_NAME_LENGTH,
  PRODUCT_CATALOG,
  catalogProductDisplayName,
  catalogProductToUserProduct,
  normalizeProductSearchText,
  searchFallbackToUserProduct,
  searchProductCatalog,
  type CatalogProduct,
} from "@/lib/product-catalog";
import {
  USER_PRODUCT_CATEGORIES,
  useOnboarding,
  type UserProductCategory,
} from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import { USER_PRODUCT_CATEGORY_LABELS } from "@/lib/labels";
import { PRODUCT_IMAGES } from "@/lib/product-images";
import {
  AppText,
  Chip,
  OptionRow,
  PrimaryButton,
  Screen,
  SectionHeader,
  TextField,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

const ACTIVE_KEYS = Object.keys(ACTIVES) as ActiveKey[];
const MIN_SEARCH_QUERY_LENGTH = 2;

function ProductSearchResult({
  item,
  onPress,
}: {
  item: CatalogProduct;
  onPress: () => void;
}) {
  const { colors, styles } = useAddProductTheme();
  const activeSummary =
    item.keyActives.length > 0
      ? item.keyActives.map((key) => ACTIVES[key].label).join(", ")
      : "No supported key actives tagged";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${catalogProductDisplayName(item)}, ${USER_PRODUCT_CATEGORY_LABELS[item.category]}, ${activeSummary}`}
      style={({ pressed }) => [
        styles.resultRow,
        pressed && styles.resultRowPressed,
      ]}
    >
      <Image
        source={PRODUCT_IMAGES[item.imageId]}
        contentFit="contain"
        transition={100}
        accessible={false}
        style={styles.resultImage}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="overline" color={colors.textSecondary}>
          {item.brand.toUpperCase()}
        </AppText>
        <AppText variant="bodyStrong">{item.name}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {USER_PRODUCT_CATEGORY_LABELS[item.category]}. {activeSummary}
        </AppText>
        {item.notes ? (
          <AppText variant="caption" color={colors.textSecondary}>
            {item.notes}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="add-circle-outline" size={22} color={colors.actionPrimary} />
    </Pressable>
  );
}

export default function AddProduct() {
  const { colors, styles } = useAddProductTheme();
  const params = useLocalSearchParams<{
    id?: string;
    category?: string;
    stepKey?: string;
  }>();
  const { data, update } = useOnboarding();
  const { clearStepOwnership } = useRoutineLog();
  const existing =
    typeof params.id === "string"
      ? (data.userProducts ?? []).find((p) => p.id === params.id)
      : undefined;

  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState<UserProductCategory>(
    existing?.category ??
      (USER_PRODUCT_CATEGORIES.includes(params.category as UserProductCategory)
        ? (params.category as UserProductCategory)
        : "cleanser"),
  );
  const [actives, setActives] = useState<ActiveKey[]>(existing?.actives ?? []);
  const [unknown, setUnknown] = useState(existing?.ingredientsUnknown ?? false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(
    existing?.catalogId,
  );
  const searchStarted = useRef(false);
  const emptyQueries = useRef(new Set<string>());

  const normalizedSearchQuery = useMemo(
    () => normalizeProductSearchText(searchQuery),
    [searchQuery],
  );
  const searchResults = useMemo(
    () => (selectedCatalogId ? [] : searchProductCatalog(searchQuery)),
    [searchQuery, selectedCatalogId],
  );
  const selectedCatalogProduct = useMemo(
    () => PRODUCT_CATALOG.find((item) => item.id === selectedCatalogId),
    [selectedCatalogId],
  );

  useEffect(() => {
    if (
      selectedCatalogId ||
      normalizedSearchQuery.length < MIN_SEARCH_QUERY_LENGTH ||
      searchResults.length > 0 ||
      emptyQueries.current.has(normalizedSearchQuery)
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      emptyQueries.current.add(normalizedSearchQuery);
      track("product_search_empty", {
        query_length: normalizedSearchQuery.length,
      });
    }, 450);
    return () => clearTimeout(timeout);
  }, [normalizedSearchQuery, searchResults.length, selectedCatalogId]);

  const changeSearchQuery = (value: string) => {
    setSearchQuery(value);
    setSelectedCatalogId(undefined);
    const normalized = normalizeProductSearchText(value);
    if (!searchStarted.current && normalized) {
      searchStarted.current = true;
      track("product_search_started", {
        source: existing ? "edit_product" : "add_product",
      });
    }
  };

  const selectCatalogProduct = (item: CatalogProduct) => {
    const mapped = catalogProductToUserProduct(item, {
      id: existing?.id ?? `catalog-preview-${item.id}`,
    });
    setName(mapped.name);
    setCategory(mapped.category);
    setActives(mapped.actives ?? []);
    setUnknown(false);
    setSearchQuery(catalogProductDisplayName(item));
    setSelectedCatalogId(item.id);
    track("product_search_selected", {
      category: item.category,
      has_actives: item.keyActives.length > 0,
      query_length: normalizedSearchQuery.length,
      result_position:
        searchResults.findIndex((result) => result.id === item.id) + 1,
    });
  };

  const useManualFallback = () => {
    const fallback = searchFallbackToUserProduct(searchQuery, {
      id: existing?.id ?? "search-fallback-preview",
    });
    if (!fallback) return;
    if (!emptyQueries.current.has(normalizedSearchQuery)) {
      emptyQueries.current.add(normalizedSearchQuery);
      track("product_search_empty", {
        query_length: normalizedSearchQuery.length,
      });
    }
    setName(fallback.name);
    setCategory(fallback.category);
    setActives([]);
    setUnknown(true);
    setSearchQuery("");
    setSelectedCatalogId(undefined);
  };

  const toggleActive = (key: ActiveKey) => {
    setUnknown(false);
    setActives((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleUnknown = () => {
    setUnknown((prev) => {
      if (!prev) setActives([]);
      return !prev;
    });
  };

  const changeName = (value: string) => {
    setName(value);
    if (
      selectedCatalogProduct &&
      value.trim() !== catalogProductDisplayName(selectedCatalogProduct)
    ) {
      // A changed name is now a manual product, so the old package image must
      // not follow it into Shelf or the routine.
      setSelectedCatalogId(undefined);
      setSearchQuery("");
    }
  };

  const save = () => {
    // Bound here too: the TextField cap is a UI affordance, and this is the one
    // path that actually writes into profiles.onboarding jsonb.
    const trimmed = name.trim().slice(0, MAX_PRODUCT_NAME_LENGTH);
    if (!trimmed) return;
    const fields = {
      name: trimmed,
      category,
      ...(selectedCatalogId ? { catalogId: selectedCatalogId } : {}),
      ...(actives.length > 0 ? { actives } : {}),
      ...(unknown && actives.length === 0 ? { ingredientsUnknown: true } : {}),
    };
    if (existing) {
      const updated: UserProduct = {
        id: existing.id,
        ...fields,
        ...(existing.addedAt ? { addedAt: existing.addedAt } : {}),
      };
      update({
        userProducts: (data.userProducts ?? []).map((p) =>
          p.id === existing.id ? updated : p,
        ),
      });
      track("shelf_product_edited", {
        category,
        has_actives: actives.length > 0,
        ingredients_unknown: unknown,
      });
    } else {
      const product: UserProduct = {
        id: `product-${Date.now()}`,
        ...fields,
        addedAt: new Date().toISOString(),
      };
      update({ userProducts: [...(data.userProducts ?? []), product] });
      track("shelf_product_added", {
        category,
        has_actives: actives.length > 0,
        ingredients_unknown: unknown,
      });
    }
    if (typeof params.stepKey === "string" && params.stepKey) {
      clearStepOwnership(params.stepKey);
    }
    router.back();
  };

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <AppText variant="titleSans">
          {existing ? "Edit product" : "Add a product"}
        </AppText>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="bodyStrong">Search first</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          Pick a match to fill the shelf details.
        </AppText>
      </View>
      <TextField
        label="Search products"
        placeholder="Try CeraVe, retinol, or cleanser"
        value={searchQuery}
        onChangeText={changeSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        // An unmatched query becomes the product name via
        // searchFallbackToUserProduct, so it carries the same ceiling.
        maxLength={MAX_PRODUCT_NAME_LENGTH}
      />
      <AppText variant="caption" color={colors.textSecondary}>
        Formulas can change. Check your label.
      </AppText>

      {selectedCatalogId ? (
        <View style={styles.selectedProduct} accessibilityLiveRegion="polite">
          {selectedCatalogProduct ? (
            <Image
              source={PRODUCT_IMAGES[selectedCatalogProduct.imageId]}
              contentFit="contain"
              accessible={false}
              style={styles.selectedImage}
            />
          ) : null}
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong" color={colors.actionPrimary}>
              Product selected
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Details filled below. You can still edit them.
            </AppText>
          </View>
        </View>
      ) : normalizedSearchQuery.length >= MIN_SEARCH_QUERY_LENGTH ? (
        searchResults.length > 0 ? (
          <View
            style={styles.results}
            accessibilityLabel={`${searchResults.length} search results`}
          >
            {searchResults.map((item) => (
              <ProductSearchResult
                key={item.id}
                item={item}
                onPress={() => selectCatalogProduct(item)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyResult} accessibilityLiveRegion="polite">
            <AppText variant="bodyStrong">No catalog match</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Add it manually. It stays Not rated until ingredients are tagged.
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Use ${searchQuery.trim()} as a manual product`}
              onPress={useManualFallback}
              style={({ pressed }) => [
                styles.manualFallback,
                pressed && styles.resultRowPressed,
              ]}
            >
              <AppText variant="bodyStrong" color={colors.actionPrimary}>
                Use this as a manual product
              </AppText>
              <Ionicons name="arrow-down" size={18} color={colors.actionPrimary} />
            </Pressable>
          </View>
        )
      ) : null}

      <View style={styles.orDivider} accessibilityElementsHidden>
        <View style={styles.dividerLine} />
        <AppText variant="overline" color={colors.textSecondary}>
          OR ADD MANUALLY
        </AppText>
        <View style={styles.dividerLine} />
      </View>

      <TextField
        label="Product name"
        placeholder="e.g. CeraVe Moisturizing Cream"
        value={name}
        onChangeText={changeName}
        returnKeyType="done"
        // Matches the bound save() applies, so the name is trimmed while typing
        // rather than silently truncated on save.
        maxLength={MAX_PRODUCT_NAME_LENGTH}
      />

      <SectionHeader title="Category" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        {USER_PRODUCT_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={USER_PRODUCT_CATEGORY_LABELS[c]}
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>

      <SectionHeader title="Active ingredients" />
      <AppText variant="caption" color={colors.textSecondary}>
        Tag actives from the label.
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        {ACTIVE_KEYS.map((key) => (
          <Chip
            key={key}
            label={ACTIVES[key].label}
            selected={actives.includes(key)}
            tone="lavender"
            onPress={() => toggleActive(key)}
          />
        ))}
      </View>
      <OptionRow
        label="I don't know the ingredients"
        hint="Pore will mark it Not rated."
        multi
        selected={unknown}
        onPress={toggleUnknown}
      />

      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton
          label={existing ? "Save changes" : "Add to shelf"}
          disabled={!name.trim()}
          onPress={save}
        />
      </View>
    </Screen>
  );
}

function useAddProductTheme() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  results: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  resultRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultRowPressed: { backgroundColor: colors.successSoft },
  resultImage: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  selectedProduct: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brandAccent,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  selectedImage: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  emptyResult: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  manualFallback: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  });
}
