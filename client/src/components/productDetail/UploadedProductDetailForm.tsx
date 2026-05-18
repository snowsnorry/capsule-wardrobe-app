import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import {
  Box,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  PRODUCT_AUDIENCE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_CLOSURE_TYPE_OPTIONS,
  PRODUCT_COLOR_BASE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_FIT_OPTIONS,
  PRODUCT_FORMALITY_LEVEL_OPTIONS,
  PRODUCT_MATERIAL_OPTIONS,
  PRODUCT_OCCASION_OPTIONS,
  PRODUCT_PATTERN_OPTIONS,
  PRODUCT_SEASON_OPTIONS,
  PRODUCT_SILHOUETTE_OPTIONS,
  PRODUCT_STYLE_OPTIONS,
} from "../../../../shared/productMetadataOptions.js";
import { translateOption } from "../../i18n";
import type { UploadedProductFormState } from "./UploadedProductDetailFormState";

type UploadedProductDetailFormProps = {
  form: UploadedProductFormState;
  locale: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  onChange: (form: UploadedProductFormState) => void;
};

type SingleSelectConfig = {
  fieldKey: keyof Pick<
    UploadedProductFormState,
    "audience" | "category" | "pattern" | "finish" | "silhouette" | "fit"
  >;
  label: string;
  options: readonly string[];
  optionGroup: string;
  required?: boolean;
};

type MultiSelectConfig = {
  fieldKey: keyof Pick<
    UploadedProductFormState,
    | "season"
    | "formalityLevel"
    | "style"
    | "occasions"
    | "colorBase"
    | "closureType"
  >;
  label: string;
  options: readonly string[];
  optionGroup: string;
  required?: boolean;
};

const nullableValue = "__none__";

function UploadedProductDetailForm({
  form,
  locale,
  t,
  onChange,
}: UploadedProductDetailFormProps) {
  const setField = <TKey extends keyof UploadedProductFormState>(
    key: TKey,
    value: UploadedProductFormState[TKey],
  ) => onChange({ ...form, [key]: value });
  const emptyLabel = t("myWardrobe.uploadedDetail.notSpecified");

  return (
    <Stack spacing={2} sx={{ minHeight: 0, p: { xs: 2, md: 0 } }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <PhotoCameraOutlinedIcon
          className="uploaded-detail-camera-icon"
          color="secondary"
        />
        <Typography variant="h5">
          {t("myWardrobe.uploadedDetail.title")}
        </Typography>
      </Stack>
      <Box sx={formGridSx}>
        <UploadedProductTextFields form={form} t={t} setField={setField} />
        {getSingleSelectConfigs(t).map((field) => (
          <SingleSelectField
            key={field.fieldKey}
            {...field}
            locale={locale}
            emptyLabel={emptyLabel}
            value={form[field.fieldKey]}
            onChange={(value) =>
              setField(field.fieldKey, value || (field.required ? "" : null))
            }
          />
        ))}
        {getMultiSelectConfigs(t).map((field) => (
          <MultiSelectField
            key={field.fieldKey}
            {...field}
            locale={locale}
            values={form[field.fieldKey]}
            onChange={(value) => setField(field.fieldKey, value)}
          />
        ))}
        <MultiSelectField
          label={t("search.fields.composition")}
          values={form.compositionValues}
          options={PRODUCT_MATERIAL_OPTIONS}
          optionGroup="materials"
          locale={locale}
          onChange={(value) =>
            onChange({
              ...form,
              composition: value.length > 0 ? value.join(", ") : null,
              compositionValues: value,
            })
          }
        />
      </Box>
    </Stack>
  );
}

function UploadedProductTextFields({
  form,
  setField,
  t,
}: {
  form: UploadedProductFormState;
  setField: <TKey extends keyof UploadedProductFormState>(
    key: TKey,
    value: UploadedProductFormState[TKey],
  ) => void;
  t: UploadedProductDetailFormProps["t"];
}) {
  return (
    <>
      <TextField
        required
        label={t("myWardrobe.uploadedDetail.fields.name")}
        sx={fullWidthGridItemSx}
        value={form.name}
        onChange={(event) => setField("name", event.target.value)}
      />
      <TextField
        label={t("myWardrobe.uploadedDetail.fields.description")}
        sx={fullWidthGridItemSx}
        value={form.description || ""}
        multiline
        minRows={3}
        onChange={(event) =>
          setField("description", nullableDraftText(event.target.value))
        }
      />
      <TextField
        label={t("myWardrobe.uploadedDetail.fields.brand")}
        value={form.brand || ""}
        onChange={(event) =>
          setField("brand", nullableDraftText(event.target.value))
        }
      />
    </>
  );
}

const nullableDraftText = (value: string): string | null => value || null;

function getSingleSelectConfigs(
  t: UploadedProductDetailFormProps["t"],
): SingleSelectConfig[] {
  return [
    {
      fieldKey: "audience",
      required: true,
      label: t("search.fields.audience"),
      options: PRODUCT_AUDIENCE_OPTIONS,
      optionGroup: "audience",
    },
    {
      fieldKey: "category",
      required: true,
      label: t("search.filters.category"),
      options: PRODUCT_CATEGORY_OPTIONS,
      optionGroup: "categories",
    },
    {
      fieldKey: "pattern",
      label: t("search.fields.pattern"),
      options: PRODUCT_PATTERN_OPTIONS,
      optionGroup: "patterns",
    },
    {
      fieldKey: "finish",
      label: t("search.fields.finish"),
      options: PRODUCT_FINISH_OPTIONS,
      optionGroup: "finishes",
    },
    {
      fieldKey: "silhouette",
      label: t("search.fields.silhouette"),
      options: PRODUCT_SILHOUETTE_OPTIONS,
      optionGroup: "silhouettes",
    },
    {
      fieldKey: "fit",
      label: t("search.fields.fit"),
      options: PRODUCT_FIT_OPTIONS,
      optionGroup: "fits",
    },
  ];
}

function getMultiSelectConfigs(
  t: UploadedProductDetailFormProps["t"],
): MultiSelectConfig[] {
  return [
    {
      fieldKey: "season",
      required: true,
      label: t("search.fields.season"),
      options: PRODUCT_SEASON_OPTIONS,
      optionGroup: "seasons",
    },
    {
      fieldKey: "formalityLevel",
      label: t("search.fields.formalityLevel"),
      options: PRODUCT_FORMALITY_LEVEL_OPTIONS,
      optionGroup: "styles",
    },
    {
      fieldKey: "style",
      label: t("search.fields.style"),
      options: PRODUCT_STYLE_OPTIONS,
      optionGroup: "styles",
    },
    {
      fieldKey: "occasions",
      label: t("search.fields.occasions"),
      options: PRODUCT_OCCASION_OPTIONS,
      optionGroup: "occasions",
    },
    {
      fieldKey: "colorBase",
      label: t("search.fields.color"),
      options: PRODUCT_COLOR_BASE_OPTIONS,
      optionGroup: "accentColors",
    },
    {
      fieldKey: "closureType",
      label: t("search.fields.closureType"),
      options: PRODUCT_CLOSURE_TYPE_OPTIONS,
      optionGroup: "closureTypes",
    },
  ];
}

function SingleSelectField({
  emptyLabel,
  label,
  locale,
  onChange,
  optionGroup,
  options,
  required = false,
  value,
}: SingleSelectConfig & {
  emptyLabel: string;
  locale: string;
  onChange: (value: string | null) => void;
  value: string | null;
}) {
  const labelId = `${label.replace(/\s+/g, "-").toLowerCase()}-label`;

  return (
    <FormControl required={required}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        value={value || nullableValue}
        label={label}
        onChange={(event) =>
          onChange(
            event.target.value === nullableValue ? null : event.target.value,
          )
        }
      >
        <MenuItem value={nullableValue}>
          <em>{emptyLabel}</em>
        </MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {translateOption(optionGroup, option, locale)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function MultiSelectField({
  label,
  locale,
  onChange,
  optionGroup,
  options,
  required = false,
  values,
}: Omit<MultiSelectConfig, "fieldKey"> & {
  locale: string;
  onChange: (value: string[]) => void;
  values: string[];
}) {
  const labelId = `${label.replace(/\s+/g, "-").toLowerCase()}-label`;

  return (
    <FormControl required={required}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        multiple
        labelId={labelId}
        value={values}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) =>
          selected
            .map((value) => translateOption(optionGroup, value, locale))
            .join(", ")
        }
        onChange={(event: SelectChangeEvent<string[]>) => {
          const value = event.target.value;
          onChange(typeof value === "string" ? value.split(",") : value);
        }}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={values.includes(option)} />
            <ListItemText
              primary={translateOption(optionGroup, option, locale)}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

const formGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
  gap: 2,
} as const;

const fullWidthGridItemSx = {
  gridColumn: { xs: "1", md: "1 / -1" },
} as const;

export default UploadedProductDetailForm;
