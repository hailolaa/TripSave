import 'package:flutter_bloc/flutter_bloc.dart';
import '../savings_repository.dart';

abstract class SavingsState {}

class SavingsInitial extends SavingsState {}

class SavingsLoading extends SavingsState {}

class SavingsLoaded extends SavingsState {
  final List<SavingsRecord> records;
  final double totalSaved;

  SavingsLoaded(this.records, this.totalSaved);
}

class SavingsCubit extends Cubit<SavingsState> {
  final SavingsRepository _repository;

  SavingsCubit(this._repository) : super(SavingsInitial()) {
    loadSavings();
  }

  void loadSavings() {
    emit(SavingsLoading());
    final records = _repository.getRecords();
    final total = _repository.getTotalSaved();
    emit(SavingsLoaded(records, total));
  }

  Future<void> addSavingsRecord({
    required String storeName,
    required double amountSaved,
    required String category,
    required String iconName,
  }) async {
    final record = SavingsRecord(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      date: DateTime.now(),
      storeName: storeName,
      amountSaved: amountSaved,
      category: category,
      iconName: iconName,
    );
    await _repository.addRecord(record);
    loadSavings();
  }

  void clear() {
    emit(SavingsInitial());
  }
}
