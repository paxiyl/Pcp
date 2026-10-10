import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { PresetPicker } from "@/components/preset-picker";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useSession } from "@/features/auth/use-session";
import { useProductCategories } from "@/features/catalogue/use-stores";
import {
  useCreateStoreProduct,
  useStoreOwnerProducts,
  useUpdateStoreProduct,
} from "@/features/store-owner/use-store-owner";
import type { Product, ProductCategory } from "@/lib/api";
import { parseRupees } from "@/lib/format";
import { toast } from "@/lib/sonner";

type Errors = { name?: string; price?: string; unit?: string; category?: string; mrp?: string };

/**
 * The category id, whichever shape the API sent.
 *
 * `/store-owner/products` populates the category so the shelf can print its
 * name, so this field is sometimes a string and sometimes `{ _id, name, slug }`.
 * Sending the object back would fail the server's objectId check and read as
 * "choose a category" on a form that already had one chosen.
 */
const categoryIdOf = (product?: Product): string => {
  const value = product?.categoryId;

  if (!value) return "";

  return typeof value === "string" ? value : value._id;
};

/** Paise to the figure a shopkeeper would type: 26500 -> "265", 4250 -> "42.50". */
const toRupeeField = (paise: number): string =>
  paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);

/**
 * Putting something on the shelf, and editing what is already there.
 *
 * The shelf tab stays a stock control — steppers, no keyboard, no price — for
 * the same reason the kitchen's menu tab stays a row of switches. Listing an
 * item and repricing it are separate, deliberate acts, and they live here.
 *
 * Price is asked for on this screen and refused on that one, which is not a
 * contradiction. A price that can move from the shelf screen changes a total a
 * customer has already seen; a price changed here is changed on purpose, by the
 * only person who knows what the stock cost.
 */
export default function ProductFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isStoreOwner } = useSession();
  // Unfiltered on purpose: the shelf tab's query is search-scoped, and looking a
  // product up in whichever filtered list happened to be cached is how an edit
  // screen opens empty.
  const { data: products, isLoading } = useStoreOwnerProducts();
  const { data: categories, isLoading: loadingCategories } = useProductCategories();
  const [subtle] = useCSSVariable(["--color-text-muted"]);

  const existing = id ? (products ?? []).find((product) => product._id === id) : undefined;

  if (!isStoreOwner) {
    return (
      <Screen edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Ionicons color={subtle as string} name="lock-closed-outline" size={32} />
          <Text className="text-center font-sans text-body text-text-secondary">
            Only a shop owner can change the shelf.
          </Text>
          <Button label="Go back" onPress={() => router.back()} variant="outline" />
        </View>
      </Screen>
    );
  }

  if (id && !existing) {
    return (
      <Screen edges={["top"]}>
        <FormHeader onClose={() => router.back()} title="Edit product" />
        {isLoading ? (
          <View className="gap-4 px-gutter pt-5">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton className="h-13 rounded-input" key={key} />
            ))}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-gutter">
            <Text className="text-center font-sans text-body text-text-secondary">
              We could not find that product on your shelf.
            </Text>
            <Button label="Go back" onPress={() => router.back()} variant="outline" />
          </View>
        )}
      </Screen>
    );
  }

  /*
    Leaf categories only. A product filed under "Grocery" when "Atta & Rice"
    exists is a product the customer will not find, because every strip and
    filter in the app walks the tree downwards.
  */
  const parents = new Set((categories ?? []).map((category) => category.parentId).filter(Boolean));
  const choices = (categories ?? []).filter((category) => !parents.has(category._id));

  /*
    Keyed on the record, so the fields are initialised from it once and then
    belong to the person typing. Prefilling with an effect instead is how an edit
    screen overwrites what somebody has just typed the moment a background
    refetch lands.
  */
  return (
    <ProductForm
      categories={choices}
      key={existing?._id ?? "new"}
      loadingCategories={loadingCategories}
      product={existing}
    />
  );
}

function FormHeader({ onClose, title }: { onClose: () => void; title: string }) {
  const [subtle] = useCSSVariable(["--color-text-muted"]);

  return (
    <View className="flex-row items-center gap-2 px-gutter pt-4">
      <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={10} onPress={onClose}>
        <Ionicons color={subtle as string} name="close" size={26} />
      </Pressable>
      <Text accessibilityRole="header" className="font-title text-title text-foreground">
        {title}
      </Text>
    </View>
  );
}

function ProductForm({
  categories,
  loadingCategories,
  product,
}: {
  categories: ProductCategory[];
  loadingCategories: boolean;
  product?: Product;
}) {
  const router = useRouter();
  const create = useCreateStoreProduct();
  const update = useUpdateStoreProduct();

  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [price, setPrice] = useState(product ? toRupeeField(product.price) : "");
  const [mrp, setMrp] = useState(product?.mrp ? toRupeeField(product.mrp) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [categoryId, setCategoryId] = useState(categoryIdOf(product));
  const [imagePreset, setImagePreset] = useState(product?.imagePreset ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (pending) return;

    const paise = parseRupees(price);
    const mrpPaise = mrp.trim() ? parseRupees(mrp) : undefined;
    const next: Errors = {};

    if (name.trim().length < 2) next.name = "Enter the product name";
    if (unit.trim().length < 1) next.unit = "Enter a pack size, like 1 kg";
    if (paise === null) next.price = "Enter a price, like 45 or 42.50";
    if (mrp.trim() && mrpPaise == null) next.mrp = "Enter a printed price, or leave it empty";
    if (mrpPaise != null && paise !== null && mrpPaise < paise) {
      next.mrp = "The printed price cannot be below what you charge";
    }
    if (!categoryId) next.category = "Choose where this sits in the catalogue";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const typed = Number(stock.trim());
    const input = {
      brand: brand.trim(),
      categoryId,
      imagePreset,
      ...(mrpPaise != null ? { mrp: mrpPaise } : {}),
      name: name.trim(),
      price: paise as number,
      // Empty means "not counted yet", which is 0 and out of stock — not a
      // silent default that sells something off an empty shelf.
      stock: stock.trim() && Number.isFinite(typed) ? Math.max(Math.trunc(typed), 0) : 0,
      unit: unit.trim(),
    };

    const onError = (error: Error) => {
      toast.error(product ? "Could not save that product" : "Could not add that product", {
        description: error.message,
      });
    };

    if (product) {
      update.mutate(
        { productId: product._id, ...input },
        {
          onError,
          onSuccess: (response) => {
            toast.success(`${response.data.product.name} saved`);
            router.back();
          },
        },
      );

      return;
    }

    create.mutate(input, {
      onError,
      onSuccess: (response) => {
        toast.success(`${response.data.product.name} is on your shelf`);
        router.back();
      },
    });
  };

  return (
    <Screen edges={["top"]}>
      <FormHeader onClose={() => router.back()} title={product ? "Edit product" : "Add a product"} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="gap-4 px-gutter pb-10 pt-5"
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            autoCapitalize="words"
            error={errors.name}
            label="Name"
            onChangeText={(value) => {
              setName(value);
              if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Aashirvaad atta"
            value={name}
          />

          <TextField
            error={errors.unit}
            label="Pack size"
            onChangeText={(value) => {
              setUnit(value);
              if (errors.unit) setErrors((current) => ({ ...current, unit: undefined }));
            }}
            placeholder="5 kg"
            value={unit}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                error={errors.price}
                keyboardType="decimal-pad"
                label="Your price (₹)"
                onChangeText={(value) => {
                  setPrice(value);
                  if (errors.price) setErrors((current) => ({ ...current, price: undefined }));
                }}
                placeholder="265"
                value={price}
              />
            </View>
            <View className="flex-1">
              <TextField
                error={errors.mrp}
                keyboardType="decimal-pad"
                label="MRP (optional)"
                onChangeText={(value) => {
                  setMrp(value);
                  if (errors.mrp) setErrors((current) => ({ ...current, mrp: undefined }));
                }}
                placeholder="290"
                value={mrp}
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                keyboardType="number-pad"
                label="Stock"
                onChangeText={setStock}
                placeholder="0"
                value={stock}
              />
            </View>
            <View className="flex-1">
              <TextField
                autoCapitalize="words"
                label="Brand (optional)"
                onChangeText={setBrand}
                placeholder="Aashirvaad"
                value={brand}
              />
            </View>
          </View>

          <View className="gap-2">
            <Text className="font-label text-label text-foreground">Category</Text>

            {loadingCategories ? (
              <View className="flex-row gap-2">
                {[0, 1, 2].map((key) => (
                  <Skeleton className="h-9 w-24 rounded-pill" key={key} />
                ))}
              </View>
            ) : categories.length === 0 ? (
              <Text className="font-sans text-caption text-text-muted">
                No categories are set up yet. Ask Raket support to add them before listing stock.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {categories.map((category) => {
                  const selected = category._id === categoryId;

                  return (
                    <Pressable
                      accessibilityLabel={category.name}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, selected }}
                      className={`h-9 justify-center rounded-pill border px-3 ${
                        selected
                          ? "border-primary bg-secondary"
                          : "border-border bg-card active:bg-muted"
                      }`}
                      key={category._id}
                      onPress={() => {
                        setCategoryId(category._id);
                        if (errors.category) {
                          setErrors((current) => ({ ...current, category: undefined }));
                        }
                      }}
                    >
                      <Text className="font-label text-caption text-foreground">
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {errors.category ? (
              <Text
                accessibilityLiveRegion="polite"
                className="font-label text-label text-destructive"
              >
                {errors.category}
              </Text>
            ) : null}
          </View>

          <PresetPicker catalogue="grocery" onChange={setImagePreset} value={imagePreset} />

          <Button
            label={product ? "Save changes" : "Add to shelf"}
            loading={pending}
            onPress={submit}
          />

          <Text className="text-center font-sans text-caption text-text-muted">
            Day-to-day counts are quicker from the Shelf tab.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
