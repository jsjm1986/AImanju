import { defineStore } from 'pinia';
import { characterApi } from '@/services/api';
import type { Character } from '@/types';

interface CharacterState {
  characters: Character[];
  currentCharacter: Character | null;
  loading: boolean;
  error: string | null;
}

export const useCharacterStore = defineStore('character', {
  state: (): CharacterState => ({
    characters: [],
    currentCharacter: null,
    loading: false,
    error: null,
  }),

  getters: {
    getCharacterById: (state) => (id: string) => {
      return state.characters.find((c) => c._id === id);
    },
    getCharacterByName: (state) => (name: string) => {
      return state.characters.find((c) => c.name === name);
    },
  },

  actions: {
    async fetchCharacters(projectId: string) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await characterApi.getByProject(projectId);
        if (data.success && data.data) {
          this.characters = data.data;
        }
      } catch (error) {
        this.error = (error as Error).message;
      } finally {
        this.loading = false;
      }
    },

    async createCharacter(characterData: Partial<Character>) {
      this.loading = true;
      try {
        const { data } = await characterApi.create(characterData);
        if (data.success && data.data) {
          this.characters.push(data.data);
          return data.data;
        }
      } catch (error) {
        this.error = (error as Error).message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateCharacter(id: string, characterData: Partial<Character>) {
      this.loading = true;
      try {
        const { data } = await characterApi.update(id, characterData);
        if (data.success && data.data) {
          const index = this.characters.findIndex((c) => c._id === id);
          if (index !== -1) {
            this.characters[index] = data.data;
          }
          return data.data;
        }
      } catch (error) {
        this.error = (error as Error).message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteCharacter(id: string) {
      try {
        await characterApi.delete(id);
        this.characters = this.characters.filter((c) => c._id !== id);
      } catch (error) {
        this.error = (error as Error).message;
        throw error;
      }
    },

    setCurrentCharacter(character: Character | null) {
      this.currentCharacter = character;
    },

    clearCharacters() {
      this.characters = [];
      this.currentCharacter = null;
    },
  },
});
