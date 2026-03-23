export class SeasonManager {
  constructor(state, seasonsData) {
    this.state = state;
    this.seasons = seasonsData.seasons;
  }

  getCurrentSeason() {
    const month = this.state.time.month;
    return this.seasons.find(s => s.months.includes(month)) || this.seasons[0];
  }

  getCustomerFlowMult() {
    return this.getCurrentSeason().customerFlowMult;
  }

  getIngredientCostMult() {
    return this.getCurrentSeason().ingredientCostMult;
  }

  getGenrePopularityMult(genre) {
    const season = this.getCurrentSeason();
    return season.genreBonus[genre] || 1.0;
  }

  getCustomerTypeMult(customerTypeId) {
    const season = this.getCurrentSeason();
    return season.customerBonus[customerTypeId] || 1.0;
  }

  getEventWeightBonus(eventId) {
    const season = this.getCurrentSeason();
    return season.eventWeightBonus[eventId] || 1.0;
  }

  getSeasonInfo() {
    const s = this.getCurrentSeason();
    return {
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      color: s.color
    };
  }
}
