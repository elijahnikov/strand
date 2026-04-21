import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  type RemixiconComponentType,
  RiBardFill,
  RiBookmarkFill,
  RiFolder5Fill,
  RiHashtag,
  RiLinksFill,
  RiStackFill,
  RiStarFill,
  RiUserFill,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType, SVGProps } from "react";
import {
  LIST_OPERATORS,
  type ListOperator,
  NO_COLLECTION_SENTINEL,
  useSearchFilters,
} from "../use-search-filters";
import { BooleanPicker } from "./pickers/boolean-picker";
import { CollectionPicker } from "./pickers/collection-picker";
import { ConceptPicker } from "./pickers/concept-picker";
import { CreatedByPicker } from "./pickers/created-by-picker";
import {
  EMBED_TYPE_LABELS,
  EmbedTypePicker,
} from "./pickers/embed-type-picker";
import { TagPicker } from "./pickers/tag-picker";
import { TypePicker } from "./pickers/type-picker";
export type FilterId =
  | "type"
  | "embedType"
  | "concept"
  | "tag"
  | "createdBy"
  | "collection"
  | "pinned"
  | "favorite";

export interface PickerProps {
  onClose: () => void;
  workspaceId: Id<"workspace">;
}

export interface ChipContent {
  clear: () => void;
  operator: string | null;
  operatorLabels: Record<string, string>;
  operators: readonly string[];
  setOperator: (value: string | null) => void;
  valueLabel: string;
}

export type FilterIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface FilterConfig {
  Icon: RemixiconComponentType;
  id: FilterId;
  name: string;
  Picker: ComponentType<PickerProps>;
  useChipContent: (workspaceId: Id<"workspace">) => ChipContent;
  useIsActive: () => boolean;
}

const LIST_OP_LABELS: Record<ListOperator, string> = {
  is: "is",
  isNot: "is not",
};

const TYPE_LABELS: Record<string, string> = {
  website: "Website",
  note: "Note",
  file: "File",
};

function summarizeList(
  names: ReadonlyArray<string | undefined | null>,
  totalCount: number
): string {
  const clean = names.filter(
    (n): n is string => typeof n === "string" && n.length > 0
  );
  if (clean.length === 0) {
    return `${totalCount} selected`;
  }
  if (clean.length <= 2) {
    return clean.join(", ");
  }
  return `${clean.slice(0, 2).join(", ")} +${clean.length - 2}`;
}

export const FILTER_CONFIGS: FilterConfig[] = [
  {
    id: "type",
    name: "Type",
    Icon: RiStackFill,
    Picker: TypePicker,
    useIsActive: () => (useSearchFilters().types?.length ?? 0) > 0,
    useChipContent: () => {
      const { types, setTypes, typeOp, setTypeOp } = useSearchFilters();
      return {
        valueLabel: (types ?? []).map((t) => TYPE_LABELS[t] ?? t).join(", "),
        operator: typeOp ?? "is",
        operators: LIST_OPERATORS,
        operatorLabels: LIST_OP_LABELS,
        setOperator: (v) => setTypeOp(v as ListOperator | null),
        clear: () => {
          setTypes(null);
          setTypeOp(null);
        },
      };
    },
  },
  {
    id: "embedType",
    name: "Embed",
    Icon: RiLinksFill,
    Picker: EmbedTypePicker,
    useIsActive: () => (useSearchFilters().embedTypes?.length ?? 0) > 0,
    useChipContent: () => {
      const { embedTypes, setEmbedTypes, embedTypeOp, setEmbedTypeOp } =
        useSearchFilters();
      const labels = (embedTypes ?? []).map((t) => EMBED_TYPE_LABELS[t] ?? t);
      return {
        valueLabel: summarizeList(labels, labels.length),
        operator: embedTypeOp ?? "is",
        operators: LIST_OPERATORS,
        operatorLabels: LIST_OP_LABELS,
        setOperator: (v) => setEmbedTypeOp(v as ListOperator | null),
        clear: () => {
          setEmbedTypes(null);
          setEmbedTypeOp(null);
        },
      };
    },
  },
  {
    id: "concept",
    name: "Concept",
    Icon: RiBardFill,
    Picker: ConceptPicker,
    useIsActive: () => useSearchFilters().conceptIds.length > 0,
    useChipContent: (workspaceId) => {
      const { conceptIds, setConceptIds, conceptOp, setConceptOp } =
        useSearchFilters();
      const { data } = useQuery(
        convexQuery(api.search.queries.listTopConcepts, {
          workspaceId,
          limit: 100,
        })
      );
      const names = conceptIds.map(
        (id) => data?.find((c) => c._id === id)?.name
      );
      return {
        valueLabel: summarizeList(names, conceptIds.length),
        operator: conceptOp ?? "is",
        operators: LIST_OPERATORS,
        operatorLabels: LIST_OP_LABELS,
        setOperator: (v) => setConceptOp(v as ListOperator | null),
        clear: () => {
          setConceptIds(null);
          setConceptOp(null);
        },
      };
    },
  },
  {
    id: "tag",
    name: "Tag",
    Icon: RiHashtag,
    Picker: TagPicker,
    useIsActive: () => useSearchFilters().tagIds.length > 0,
    useChipContent: (workspaceId) => {
      const { tagIds, setTagIds, tagOp, setTagOp } = useSearchFilters();
      const { data } = useQuery(
        convexQuery(api.search.queries.listTopTags, {
          workspaceId,
          limit: 100,
        })
      );
      const names = tagIds.map((id) => data?.find((t) => t._id === id)?.name);
      return {
        valueLabel: summarizeList(names, tagIds.length),
        operator: tagOp ?? "is",
        operators: LIST_OPERATORS,
        operatorLabels: LIST_OP_LABELS,
        setOperator: (v) => setTagOp(v as ListOperator | null),
        clear: () => {
          setTagIds(null);
          setTagOp(null);
        },
      };
    },
  },
  {
    id: "createdBy",
    name: "Created by",
    Icon: RiUserFill,
    Picker: CreatedByPicker,
    useIsActive: () => useSearchFilters().createdByIds.length > 0,
    useChipContent: (workspaceId) => {
      const { createdByIds, setCreatedByIds, createdByOp, setCreatedByOp } =
        useSearchFilters();
      const { data } = useQuery(
        convexQuery(api.workspace.queries.listMembers, { workspaceId })
      );
      const names = createdByIds.map(
        (id) => data?.find((m) => m.userId === id)?.username
      );
      return {
        valueLabel: summarizeList(names, createdByIds.length),
        operator: createdByOp ?? "is",
        operators: LIST_OPERATORS,
        operatorLabels: LIST_OP_LABELS,
        setOperator: (v) => setCreatedByOp(v as ListOperator | null),
        clear: () => {
          setCreatedByIds(null);
          setCreatedByOp(null);
        },
      };
    },
  },
  {
    id: "collection",
    name: "Collection",
    Icon: RiFolder5Fill,
    Picker: CollectionPicker,
    useIsActive: () => useSearchFilters().collectionId !== null,
    useChipContent: (workspaceId) => {
      const { collectionId, setCollectionId, collectionOp, setCollectionOp } =
        useSearchFilters();
      const { data } = useQuery(
        convexQuery(api.collection.queries.listAll, { workspaceId })
      );
      const valueLabel =
        collectionId === NO_COLLECTION_SENTINEL
          ? "No collection"
          : (data?.find((c) => c._id === collectionId)?.name ?? "Loading…");
      return {
        valueLabel,
        operator: collectionOp ?? "is",
        operators: LIST_OPERATORS,
        operatorLabels: LIST_OP_LABELS,
        setOperator: (v) => setCollectionOp(v as ListOperator | null),
        clear: () => {
          setCollectionId(null);
          setCollectionOp(null);
        },
      };
    },
  },
  {
    id: "pinned",
    name: "Pinned",
    Icon: RiBookmarkFill,
    Picker: (props) => (
      <BooleanPicker
        falseLabel="Not pinned"
        filterKey="isPinned"
        onClose={props.onClose}
        trueLabel="Pinned"
      />
    ),
    useIsActive: () => useSearchFilters().isPinned !== null,
    useChipContent: () => {
      const { isPinned, setIsPinned } = useSearchFilters();
      return {
        valueLabel: isPinned ? "Pinned" : "Not pinned",
        operator: "is",
        operators: ["is"] as const,
        operatorLabels: { is: "is" },
        setOperator: () => {
          // no-op
        },
        clear: () => setIsPinned(null),
      };
    },
  },
  {
    id: "favorite",
    name: "Favorite",
    Icon: RiStarFill,
    Picker: (props) => (
      <BooleanPicker
        falseLabel="Not favorited"
        filterKey="isFavorite"
        onClose={props.onClose}
        trueLabel="Favorited"
      />
    ),
    useIsActive: () => useSearchFilters().isFavorite !== null,
    useChipContent: () => {
      const { isFavorite, setIsFavorite } = useSearchFilters();
      return {
        valueLabel: isFavorite ? "Favorited" : "Not favorited",
        operator: "is",
        operators: ["is"] as const,
        operatorLabels: { is: "is" },
        setOperator: () => {
          // no-op
        },
        clear: () => setIsFavorite(null),
      };
    },
  },
];

export const FILTER_CONFIGS_BY_ID: Record<FilterId, FilterConfig> =
  Object.fromEntries(FILTER_CONFIGS.map((c) => [c.id, c])) as Record<
    FilterId,
    FilterConfig
  >;
