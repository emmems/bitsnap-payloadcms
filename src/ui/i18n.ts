import { useTranslation } from '@payloadcms/ui'

import type { BitsnapStatus } from '../types.js'

export type BitsnapStrings = {
  locale: string
  status: Record<BitsnapStatus, string>
  linkToDoc: {
    label: string
  }
  account: {
    live: string
    test: string
    readOnlyWarning: string
  }
  manager: {
    defaultTitle: string
    unlinkedLead: string
    modeCreate: string
    modeLink: string
    linkSearchLabel: string
    linkSearchPlaceholder: string
    linkSearchHelp: string
    nameLabel: string
    priceLabel: (currency: string) => string
    basePriceLabel: (currency: string) => string
    statusLabel: string
    stockLabel: string
    stockTotalLabel: string
    stockDescription: string
    stockPlaceholder: string
    imagesLabel: string
    imagesDescription: string
    imagesPlaceholder: string
    createButton: string
    creatingButton: string
    saveButton: string
    savingButton: string
    refreshButton: string
    refreshingButton: string
    openInBitsnap: string
    unlinkButton: string
    unlinkedNotice: string
    saveDocReminder: string
    variantsTitle: string
    variantsEmpty: string
    variantNameCol: string
    variantPriceCol: (currency: string) => string
    variantStockCol: string
    variantActionsCol: string
    variantNamePlaceholder: (index: number) => string
    variantStockPlaceholder: string
    addVariant: string
    removeVariantTooltip: string
    removeVariantAria: (label: string) => string
    confirmDelete: string
    cancelDelete: string
    deleteVariantHint: string
    productMetaLabel: string
    errors: {
      loadFailed: string
      saveFailed: string
      createFailed: string
      conflict: string
      invalidBasePrice: string
      invalidStock: string
      invalidImages: string
      variantNameRequired: string
      variantPriceRequired: (name: string) => string
      variantStockInvalid: (name: string) => string
      productNameRequired: string
      productPriceRequired: (currency: string) => string
    }
    success: {
      saved: string
      created: (id: string) => string
      linked: (name: string) => string
    }
  }
  productSelect: {
    placeholder: string
    noOptions: string
    noResults: (search: string) => string
    loading: string
    loadError: string
    retry: string
    editProduct: string
    draftNotAllowed: string
  }
  rowLabel: {
    empty: (rowNumber?: number) => string
    loading: string
  }
}

const pl: BitsnapStrings = {
  locale: 'pl-PL',
  status: {
    DRAFT: 'Szkic',
    UNPUBLISHED: 'Nieopublikowany',
    PUBLISHED: 'Opublikowany',
  },
  linkToDoc: {
    label: 'Zobacz w Bitsnapie',
  },
  account: {
    live: 'LIVE',
    test: 'TEST',
    readOnlyWarning:
      'Klucz API Bitsnapa działa w trybie tylko do odczytu — zapis i tworzenie produktów są zablokowane.',
  },
  manager: {
    defaultTitle: 'Bitsnap',
    unlinkedLead:
      'Ten dokument nie jest jeszcze powiązany z produktem w Bitsnapie. Utwórz nowy produkt lub podepnij istniejący.',
    modeCreate: 'Utwórz nowy w Bitsnap',
    modeLink: 'Podepnij istniejący',
    linkSearchLabel: 'Wybierz produkt z Bitsnap',
    linkSearchPlaceholder: 'Szukaj po nazwie produktu…',
    linkSearchHelp: 'Wybrany produkt zostanie przypisany do tego dokumentu po zapisaniu.',
    nameLabel: 'Nazwa',
    priceLabel: (currency) => `Cena (${currency})`,
    basePriceLabel: (currency) => `Cena bazowa (${currency})`,
    statusLabel: 'Status',
    stockLabel: 'Limit sztuk',
    stockTotalLabel: 'Limit sztuk (łącznie)',
    stockDescription:
      'Sprzedane i zarezerwowane sztuki są od niego odejmowane. Puste pole — bez zmian.',
    stockPlaceholder: 'np. 100',
    imagesLabel: 'Zdjęcia (URL)',
    imagesDescription: 'Opcjonalne adresy URL zdjęć (po jednym w linii).',
    imagesPlaceholder: 'https://example.com/zdjecie.jpg',
    createButton: 'Utwórz produkt w Bitsnap',
    creatingButton: 'Tworzenie…',
    saveButton: 'Zapisz w Bitsnap',
    savingButton: 'Zapisywanie…',
    refreshButton: 'Odśwież',
    refreshingButton: 'Odświeżanie…',
    openInBitsnap: 'Otwórz w Bitsnap',
    unlinkButton: 'Odłącz produkt',
    unlinkedNotice: 'Odłączono produkt od dokumentu — zapisz dokument w Payload, aby utrwalić zmianę.',
    saveDocReminder: 'Pamiętaj o zapisaniu dokumentu w Payload, aby utrwalić powiązanie produktu.',
    variantsTitle: 'Warianty',
    variantsEmpty: 'Brak wariantów — produkt sprzedaje się w jednej wersji.',
    variantNameCol: 'Nazwa',
    variantPriceCol: (currency) => `Cena (${currency})`,
    variantStockCol: 'Limit sztuk',
    variantActionsCol: 'Akcje',
    variantNamePlaceholder: (index) => `Wariant ${index}, np. M`,
    variantStockPlaceholder: 'np. 10',
    addVariant: 'Dodaj wariant',
    removeVariantTooltip: 'Usuń wariant',
    removeVariantAria: (label) => `Usuń wariant ${label}`,
    confirmDelete: 'Usuń',
    cancelDelete: 'Anuluj',
    deleteVariantHint: 'Zostanie usunięty po zapisie',
    productMetaLabel: 'Produkt w Bitsnap',
    errors: {
      loadFailed: 'Nie udało się pobrać produktu z Bitsnapa',
      saveFailed: 'Nie udało się zapisać produktu w Bitsnapie',
      createFailed: 'Nie udało się utworzyć produktu w Bitsnapie',
      conflict: 'Produkt zmienił się w Bitsnapie — kliknij Odśwież',
      invalidBasePrice: 'Cena bazowa musi być poprawną liczbą',
      invalidStock: 'Limit sztuk musi być liczbą całkowitą',
      invalidImages: 'Każde zdjęcie musi być poprawnym adresem URL (http:// lub https://)',
      variantNameRequired: 'Nazwa wariantu jest wymagana',
      variantPriceRequired: (name) => `Cena wariantu „${name}” jest wymagana`,
      variantStockInvalid: (name) => `Limit sztuk wariantu „${name}” musi być liczbą całkowitą`,
      productNameRequired: 'Podaj nazwę produktu',
      productPriceRequired: (currency) => `Podaj poprawną cenę produktu (${currency})`,
    },
    success: {
      saved: 'Zapisano w Bitsnapie',
      created: (id) => `Utworzono produkt ${id} i powiązano z dokumentem`,
      linked: (name) => `Powiązano produkt „${name}” — pamiętaj o zapisaniu dokumentu`,
    },
  },
  productSelect: {
    placeholder: 'Wybierz lub wyszukaj produkt…',
    noOptions: 'Brak produktów w Bitsnapie',
    noResults: (search) => `Brak wyników dla „${search}”`,
    loading: 'Ładowanie produktów…',
    loadError: 'Nie udało się pobrać listy produktów z Bitsnapa',
    retry: 'Spróbuj ponownie',
    editProduct: 'Edytuj w Bitsnapie',
    draftNotAllowed: 'Tylko opublikowane produkty mogą zostać wybrane',
  },
  rowLabel: {
    empty: (rowNumber) => (rowNumber !== undefined ? `Produkt #${rowNumber}` : 'Nie wybrano produktu'),
    loading: 'Ładowanie…',
  },
}

const en: BitsnapStrings = {
  locale: 'en-US',
  status: {
    DRAFT: 'Draft',
    UNPUBLISHED: 'Unpublished',
    PUBLISHED: 'Published',
  },
  linkToDoc: {
    label: 'View in Bitsnap',
  },
  account: {
    live: 'LIVE',
    test: 'TEST',
    readOnlyWarning:
      'The Bitsnap API key is in read-only mode — creating and updating products is disabled.',
  },
  manager: {
    defaultTitle: 'Bitsnap',
    unlinkedLead:
      'This document is not linked to a Bitsnap product yet. Create a new product or link an existing one.',
    modeCreate: 'Create new in Bitsnap',
    modeLink: 'Link existing',
    linkSearchLabel: 'Choose a Bitsnap product',
    linkSearchPlaceholder: 'Search by product name…',
    linkSearchHelp: 'The selected product will be linked to this document once you save.',
    nameLabel: 'Name',
    priceLabel: (currency) => `Price (${currency})`,
    basePriceLabel: (currency) => `Base price (${currency})`,
    statusLabel: 'Status',
    stockLabel: 'Stock limit',
    stockTotalLabel: 'Stock limit (total)',
    stockDescription: 'Sold and reserved units are subtracted from this limit. Leave blank for no change.',
    stockPlaceholder: 'e.g. 100',
    imagesLabel: 'Images (URLs)',
    imagesDescription: 'Optional image URLs (one per line).',
    imagesPlaceholder: 'https://example.com/image.jpg',
    createButton: 'Create product in Bitsnap',
    creatingButton: 'Creating…',
    saveButton: 'Save in Bitsnap',
    savingButton: 'Saving…',
    refreshButton: 'Refresh',
    refreshingButton: 'Refreshing…',
    openInBitsnap: 'Open in Bitsnap',
    unlinkButton: 'Unlink product',
    unlinkedNotice: 'Product unlinked — save the Payload document to persist this change.',
    saveDocReminder: 'Remember to save the Payload document to persist the product link.',
    variantsTitle: 'Variants',
    variantsEmpty: 'No variants — this product is sold as a single option.',
    variantNameCol: 'Name',
    variantPriceCol: (currency) => `Price (${currency})`,
    variantStockCol: 'Stock limit',
    variantActionsCol: 'Actions',
    variantNamePlaceholder: (index) => `Variant ${index}, e.g. M`,
    variantStockPlaceholder: 'e.g. 10',
    addVariant: 'Add variant',
    removeVariantTooltip: 'Remove variant',
    removeVariantAria: (label) => `Remove variant ${label}`,
    confirmDelete: 'Remove',
    cancelDelete: 'Cancel',
    deleteVariantHint: 'Will be removed on save',
    productMetaLabel: 'Bitsnap product',
    errors: {
      loadFailed: 'Failed to load product from Bitsnap',
      saveFailed: 'Failed to save product in Bitsnap',
      createFailed: 'Failed to create product in Bitsnap',
      conflict: 'Product changed in Bitsnap — click Refresh',
      invalidBasePrice: 'Base price must be a valid number',
      invalidStock: 'Stock limit must be a non-negative integer',
      invalidImages: 'Every image must be a valid URL (http:// or https://)',
      variantNameRequired: 'Variant name is required',
      variantPriceRequired: (name) => `Price for variant "${name}" is required`,
      variantStockInvalid: (name) => `Stock limit for variant "${name}" must be an integer`,
      productNameRequired: 'Product name is required',
      productPriceRequired: (currency) => `Enter a valid product price (${currency})`,
    },
    success: {
      saved: 'Saved in Bitsnap',
      created: (id) => `Created product ${id} and linked it to this document`,
      linked: (name) => `Linked product "${name}" — remember to save the document`,
    },
  },
  productSelect: {
    placeholder: 'Select or search a product…',
    noOptions: 'No products found in Bitsnap',
    noResults: (search) => `No results for "${search}"`,
    loading: 'Loading products…',
    loadError: 'Failed to load products from Bitsnap',
    retry: 'Try again',
    editProduct: 'Edit in Bitsnap',
    draftNotAllowed: 'Only published products can be selected',
  },
  rowLabel: {
    empty: (rowNumber) => (rowNumber !== undefined ? `Product #${rowNumber}` : 'No product selected'),
    loading: 'Loading…',
  },
}

export function getBitsnapStrings(language?: string): BitsnapStrings {
  if (language && language.toLowerCase().startsWith('pl')) {
    return pl
  }
  return en
}

export function useBitsnapStrings(): BitsnapStrings {
  const { i18n } = useTranslation()
  return getBitsnapStrings(i18n?.language)
}
