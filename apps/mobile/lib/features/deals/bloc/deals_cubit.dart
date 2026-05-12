import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../deals_repository.dart';

abstract class DealsState extends Equatable {
  @override
  List<Object?> get props => [];
}

class DealsInitial extends DealsState {}
class DealsLoading extends DealsState {}

class DealsLoaded extends DealsState {
  final List<Map<String, dynamic>> deals;
  DealsLoaded(this.deals);

  @override
  List<Object?> get props => [deals];
}

class DealsError extends DealsState {
  final String message;
  DealsError(this.message);

  @override
  List<Object?> get props => [message];
}

class DealsCubit extends Cubit<DealsState> {
  final DealsRepository _repository;

  DealsCubit(this._repository) : super(DealsInitial());

  Future<void> fetchDeals({String? zip}) async {
    emit(DealsLoading());
    try {
      final deals = await _repository.getDeals(zip: zip);
      emit(DealsLoaded(deals));
    } catch (e) {
      emit(DealsError('Failed to load deals: ${e.toString()}'));
    }
  }

  void clear() {
    emit(DealsInitial());
  }
}
