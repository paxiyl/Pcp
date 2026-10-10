import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { PresetPicker } from "@/components/preset-picker";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useSession } from "@/features/auth/use-session";
import {
  useCreateKitchenDish,
  useKitchenDishes,
  useUpdateKitchenDish,
} from "@/features/kitchen/use-kitchen";
import type { Dish } from "@/lib/api";
import { parseRupees } from "@/lib/format";
import { toast } from "@/lib/sonner";

const DIET = ["Veg", "Non-veg"] as const;

type Diet = (typeof DIET)[number];

type Errors = { name?: string; price?: string; diet?: string };

/** Paise to the figure a kitchen would type: 18000 -> "180", 9950 -> "99.50". */
const toRupeeField = (paise: number): string =>
  paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);

/**
 * Putting a dish on the menu, and editing one already there.
 *
 * The menu tab stays what it was — one switch per dish, for the moment during
 * service when the paneer runs out. These are the two things a kitchen could not
 * do at all: add a dish, and change what one costs. They are a screen you
 * navigate to deliberately rather than fields beside a switch, which is exactly
 * what lets the menu tab stay safe to use with floury hands at seven in the
 * evening.
 *
 * A new kitchen's menu is empty, so this is the first screen its owner needs. It
 * used to say "ask support and they will set it up with you", which in a
 * marketplace with one operator means that operator's phone rings for every dish
 * in Hindaun.
 */
export default function DishFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isKitchenOwner } = useSession();
  // Unfiltered on purpose: the menu tab's own query is search-scoped, and
  // looking a dish up in whichever filtered list happened to be cached is how
  // an edit screen opens empty.
  const { data: dishes, isLoading } = useKitchenDishes();
  const [subtle] = useCSSVariable(["--color-text-muted"]);

  const existing = id ? (dishes ?? []).find((dish) => dish._id === id) : undefined;

  if (!isKitchenOwner) {
    return (
      <Screen edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Ionicons color={subtle as string} name="lock-closed-outline" size={32} />
          <Text className="text-center font-sans text-body text-text-secondary">
            Only a kitchen owner can change the menu.
          </Text>
          <Button label="Go back" onPress={() => router.back()} variant="outline" />
        </View>
      </Screen>
    );
  }

  if (id && !existing) {
    return (
      <Screen edges={["top"]}>
        <FormHeader onClose={() => router.back()} title="Edit dish" />
        {isLoading ? (
          <View className="gap-4 px-gutter pt-5">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton className="h-13 rounded-input" key={key} />
            ))}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-gutter">
            <Text className="text-center font-sans text-body text-text-secondary">
              We could not find that dish on your menu.
            </Text>
            <Button label="Go back" onPress={() => router.back()} variant="outline" />
          </View>
        )}
      </Screen>
    );
  }

  /*
    Keyed on the record, so the fields are initialised from it once and then
    belong to the person typing. Prefilling with an effect instead is how an
    edit screen overwrites what somebody has just typed the moment a background
    refetch lands.
  */
  return (
    <DishForm
      dish={existing}
      key={existing?._id ?? "new"}
      sections={[...new Set((dishes ?? []).map((dish) => dish.section).filter(Boolean))]}
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

function DishForm({ dish, sections }: { dish?: Dish; sections: string[] }) {
  const router = useRouter();
  const create = useCreateKitchenDish();
  const update = useUpdateKitchenDish();

  const [name, setName] = useState(dish?.name ?? "");
  const [price, setPrice] = useState(dish ? toRupeeField(dish.price) : "");
  const [section, setSection] = useState(dish?.section ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [imagePreset, setImagePreset] = useState(dish?.imagePreset ?? "");
  // Null rather than "Veg" on a new dish: required with no default on the
  // server, and a dish marked veg because nobody touched the control is the one
  // mistake here that matters to somebody.
  const [diet, setDiet] = useState<Diet | null>(dish ? (dish.isVeg ? "Veg" : "Non-veg") : null);
  const [errors, setErrors] = useState<Errors>({});

  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (pending) return;

    const paise = parseRupees(price);
    const next: Errors = {};

    if (name.trim().length < 2) next.name = "Enter the dish name";
    if (paise === null) next.price = "Enter a price, like 120 or 99.50";
    if (!diet) next.diet = "Say whether this is veg or not";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      description: description.trim(),
      imagePreset,
      isVeg: diet === "Veg",
      name: name.trim(),
      price: paise as number,
      section: section.trim() || undefined,
    };

    const onError = (error: Error) => {
      toast.error(dish ? "Could not save that dish" : "Could not add that dish", {
        description: error.message,
      });
    };

    if (dish) {
      update.mutate(
        { dishId: dish._id, ...input },
        {
          onError,
          onSuccess: (response) => {
            toast.success(`${response.data.dish.name} saved`);
            router.back();
          },
        },
      );

      return;
    }

    create.mutate(input, {
      onError,
      onSuccess: (response) => {
        toast.success(`${response.data.dish.name} is on your menu`);
        router.back();
      },
    });
  };

  return (
    <Screen edges={["top"]}>
      <FormHeader onClose={() => router.back()} title={dish ? "Edit dish" : "Add a dish"} />

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
            placeholder="Paneer butter masala"
            value={name}
          />

          <TextField
            error={errors.price}
            // decimal-pad rather than numeric: numeric offers a comma on some
            // Android keyboards, and a price with a comma in it is a price
            // nobody can read back.
            keyboardType="decimal-pad"
            label="Price (₹)"
            onChangeText={(value) => {
              setPrice(value);
              if (errors.price) setErrors((current) => ({ ...current, price: undefined }));
            }}
            placeholder="180"
            value={price}
          />

          <View className="gap-2">
            <Text className="font-label text-label text-foreground">Veg or non-veg</Text>
            <Segmented
              label="Veg or non-veg"
              onChange={(value) => {
                setDiet(value);
                if (errors.diet) setErrors((current) => ({ ...current, diet: undefined }));
              }}
              options={DIET}
              value={diet ?? undefined}
            />
            {errors.diet ? (
              <Text
                accessibilityLiveRegion="polite"
                className="font-label text-label text-destructive"
              >
                {errors.diet}
              </Text>
            ) : null}
          </View>

          <View className="gap-2">
            <TextField
              autoCapitalize="words"
              label="Menu section"
              onChangeText={setSection}
              placeholder="Main course"
              value={section}
            />
            {sections.length > 0 ? (
              <ScrollView
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {sections.map((option) => (
                  <Pressable
                    accessibilityLabel={`Use section ${option}`}
                    accessibilityRole="button"
                    className={`h-9 justify-center rounded-pill border px-3 ${
                      section.trim() === option
                        ? "border-primary bg-secondary"
                        : "border-border bg-card active:bg-muted"
                    }`}
                    key={option}
                    onPress={() => setSection(option)}
                  >
                    <Text className="font-label text-caption text-foreground">{option}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text className="font-sans text-caption text-text-muted">
                Leave this empty and the dish goes under Popular.
              </Text>
            )}
          </View>

          <TextField
            label="Description (optional)"
            multiline
            onChangeText={setDescription}
            placeholder="Cottage cheese in a tomato and cashew gravy"
            style={{ height: 76, paddingTop: 12, textAlignVertical: "top" }}
            value={description}
          />

          <PresetPicker catalogue="food" onChange={setImagePreset} value={imagePreset} />

          <Button label={dish ? "Save changes" : "Add to menu"} loading={pending} onPress={submit} />

          {dish ? null : (
            <Text className="text-center font-sans text-caption text-text-muted">
              It goes on sale straight away. Switch it off from the Menu tab whenever you run out.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
