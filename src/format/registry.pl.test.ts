import { describe, expect, it } from 'vitest';
import { COMPONENTS } from './registry';
import { buildGenerationPrompt } from './prompt';
import {
  ATTRIBUTE_DESCRIPTIONS_PL,
  COMPONENT_DESCRIPTIONS_PL,
  componentDescriptionPL,
  componentPropertiesPL,
} from './registry.pl';

describe('Polish component-guide help', () => {
  it('covers every component and unique property description without modifying the English registry', () => {
    expect(Object.keys(COMPONENT_DESCRIPTIONS_PL).sort()).toEqual(
      COMPONENTS.map((component) => component.name).sort(),
    );
    const descriptions = [
      ...new Set(
        COMPONENTS.flatMap((component) =>
          Object.values(component.attributes).map(
            (attribute) => attribute.description,
          ),
        ),
      ),
    ];
    expect(Object.keys(ATTRIBUTE_DESCRIPTIONS_PL).sort()).toEqual(
      descriptions.sort(),
    );
    for (const component of COMPONENTS) {
      expect(
        COMPONENT_DESCRIPTIONS_PL[component.name],
        component.name,
      ).toBeTruthy();
      expect(componentDescriptionPL(component)).not.toBe(component.description);
      const properties = componentPropertiesPL(component);
      expect(Object.keys(properties)).toEqual(
        Object.keys(component.properties),
      );
      for (const [name, attribute] of Object.entries(component.attributes)) {
        expect(
          ATTRIBUTE_DESCRIPTIONS_PL[attribute.description],
          `${component.name}.${name}: ${attribute.description}`,
        ).toBeTruthy();
        expect(properties[name]).toMatch(
          attribute.required ? /^Wymagane\./ : /^Opcjonalne\./,
        );
        expect(properties[name]).not.toMatch(
          /\b(Optional|Required|Allowed|Integer|Number)\b/,
        );
        for (const literal of attribute.values ?? [])
          expect(properties[name]).toContain(literal);
      }
      expect(component.properties.id).toMatch(/^(Optional|Required)\./);
    }
  });

  it('describes numeric constraints in Polish while retaining authored literal values', () => {
    const carousel = COMPONENTS.find(
      (component) => component.name === 'carousel',
    )!;
    expect(componentPropertiesPL(carousel).initial).toContain(
      'Liczba całkowita od 0 do 19999.',
    );
    const stack = COMPONENTS.find((component) => component.name === 'stack')!;
    expect(componentPropertiesPL(stack).direction).toContain(
      'Dozwolone wartości: vertical, horizontal.',
    );
    expect(buildGenerationPrompt()).toContain(
      'OUTPUT LANGUAGE: Write the notes',
    );
    expect(buildGenerationPrompt()).not.toContain(
      COMPONENT_DESCRIPTIONS_PL.carousel,
    );
  });
});
